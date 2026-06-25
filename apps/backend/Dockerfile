FROM node:20-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile --prod=false
RUN pnpm --dir apps/backend exec prisma generate
RUN pnpm --dir apps/backend run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app /app

EXPOSE 3001

CMD ["sh", "-c", "pnpm --dir apps/backend exec prisma migrate deploy && pnpm --dir apps/backend run start:prod"]
