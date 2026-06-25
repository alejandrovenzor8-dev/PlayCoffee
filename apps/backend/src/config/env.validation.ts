type Env = Record<string, string | undefined>;

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'CORS_ORIGIN',
  'PORT',
] as const;

const PLACEHOLDER_PATTERNS = [/^fallback_/i, /^change_me/i, /your_/i];

function assertPresent(env: Env, key: string) {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function assertJwtSecret(name: string, value: string, isProduction: boolean) {
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }

  if (
    isProduction &&
    PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
  ) {
    throw new Error(`${name} must not use a placeholder value in production`);
  }
}

export function validateEnv(env: Env) {
  const validated: Record<string, string> = {};

  for (const key of REQUIRED_ENV_VARS) {
    validated[key] = assertPresent(env, key);
  }

  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  const isProduction = nodeEnv === 'production';

  assertJwtSecret('JWT_SECRET', validated.JWT_SECRET, isProduction);
  assertJwtSecret(
    'JWT_REFRESH_SECRET',
    validated.JWT_REFRESH_SECRET,
    isProduction,
  );

  const port = Number(validated.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  const origins = validated.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must include at least one origin');
  }
  if (isProduction && origins.includes('*')) {
    throw new Error('CORS_ORIGIN must not be wildcard in production');
  }
  if (
    isProduction &&
    origins.some((origin) =>
      /(^http:\/\/localhost[:/]|^http:\/\/127\.0\.0\.1[:/]|^http:\/\/0\.0\.0\.0[:/]|^\*)/i.test(
        origin,
      ),
    )
  ) {
    throw new Error('CORS_ORIGIN must not point to localhost in production');
  }

  return {
    ...env,
    ...validated,
    NODE_ENV: nodeEnv,
    PORT: String(port),
    CORS_ORIGIN: origins.join(','),
  };
}
