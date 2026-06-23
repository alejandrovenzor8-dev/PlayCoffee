import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user || !user.isActive) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    const {
      passwordHash: _passwordHash,
      pin: _pin,
      refreshToken: _refreshToken,
      ...result
    } = user;
    return result;
  }

  async login(
    email: string,
    password: string,
  ): Promise<TokenPair & { user: object }> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      String(user.role),
      user.branchId ?? undefined,
    );
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, user };
  }

  async loginWithPin(
    email: string,
    pin: string,
  ): Promise<TokenPair & { user: object }> {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user || !user.isActive || !user.pin) {
      throw new UnauthorizedException('Invalid PIN credentials');
    }

    const valid = await bcrypt.compare(pin, user.pin);
    if (!valid) throw new UnauthorizedException('Invalid PIN');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const {
      passwordHash: _passwordHash,
      pin: _pin,
      refreshToken: _refreshToken,
      ...safeUser
    } = user;
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      String(user.role),
      user.branchId ?? undefined,
    );
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, user: safeUser };
  }

  async refreshTokens(token: string): Promise<TokenPair> {
    let payload: { sub: string; email: string; role: string };
    try {
      payload = this.jwt.verify(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const valid = user.refreshToken
      ? await bcrypt.compare(token, user.refreshToken)
      : false;

    if (!valid) throw new UnauthorizedException('Refresh token revoked');

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      String(user.role),
      user.branchId ?? undefined,
    );
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    branchId?: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role, branchId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_EXPIRES_IN',
        ) as unknown as number,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as unknown as number,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const hashed = await bcrypt.hash(token, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });
  }
}
