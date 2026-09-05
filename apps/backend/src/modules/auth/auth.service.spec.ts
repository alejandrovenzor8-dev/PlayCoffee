import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService sessions', () => {
  const user = {
    id: 'user-1',
    branchId: 'branch-1',
    email: 'cashier@example.com',
    firstName: 'Caja',
    lastName: 'Principal',
    passwordHash: '',
    pin: null,
    refreshToken: null,
    role: 'CASHIER',
    avatarUrl: null,
    phone: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function setup() {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
      authSession: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'session-1' })
          .mockResolvedValueOnce({ id: 'session-2' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const jwt = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-1')
        .mockResolvedValueOnce('refresh-1')
        .mockResolvedValueOnce('access-2')
        .mockResolvedValueOnce('refresh-2'),
      verify: jest.fn(),
      decode: jest.fn().mockReturnValue({ exp: 2_000_000_000 }),
    };
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key.includes('EXPIRES') ? '15m' : 'test-secret',
      ),
    };
    const service = new AuthService(
      prisma as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
    return { service, prisma, jwt };
  }

  it('creates an independent refresh session for every login', async () => {
    const { service, prisma, jwt } = setup();
    const passwordHash = await bcrypt.hash('secret', 4);
    prisma.user.findFirst.mockResolvedValue({ ...user, passwordHash });

    await service.login(user.email, 'secret');
    await service.login(user.email, 'secret');

    expect(prisma.authSession.create).toHaveBeenCalledTimes(2);
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sid: 'session-1' }),
      expect.any(Object),
    );
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ sid: 'session-2' }),
      expect.any(Object),
    );
    expect(prisma.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-1' } }),
    );
    expect(prisma.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'session-2' } }),
    );
  });

  it('revokes only the current session on logout', async () => {
    const { service, prisma } = setup();

    await service.logout('user-1', 'session-2');

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, id: 'session-2' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
