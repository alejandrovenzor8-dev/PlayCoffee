import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

type UserActor = {
  id: string;
  role: UserRoleEnum;
  branchId?: string | null;
};

type ManagedUser = {
  id: string;
  role: UserRoleEnum;
  branchId: string | null;
  isActive: boolean;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    actor?: Pick<UserActor, 'role' | 'branchId'>,
    branchId?: string,
  ) {
    const scopedBranchId = this.getReadBranchScope(actor, branchId);
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        phone: true,
        avatarUrl: true,
      },
    });
  }

  async findOne(id: string, actor?: Pick<UserActor, 'role' | 'branchId'>) {
    const target = await this.getExistingUser(id);
    this.assertCanAccessUser(actor, target);

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        phone: true,
        avatarUrl: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor?: UserActor) {
    const branchId = this.getWriteBranchScope(actor, dto.branchId);
    const role = dto.role ?? UserRoleEnum.WAITER;
    this.assertCanAssignRole(actor, role);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const { password, pin, branchId: _branchId, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 12);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;

    const user = await this.prisma.user.create({
      data: { ...rest, branchId, role, passwordHash, pin: pinHash },
    });

    const {
      passwordHash: _ph,
      pin: _pin,
      refreshToken: _rt,
      ...safeUser
    } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto, actor?: UserActor) {
    const target = await this.getExistingUser(id);
    this.assertCanMutateUser(actor, target);

    if (dto.role && dto.role !== target.role) {
      this.assertCanAssignRole(actor, dto.role);
    }
    const branchId = this.getUpdateBranchScope(actor, target, dto.branchId);

    if (target.role === UserRoleEnum.SUPER_ADMIN) {
      await this.assertCanDeactivateLastSuperAdmin(
        target,
        dto.isActive,
        dto.role,
      );
    }

    const { pin, branchId: _branchId, ...rest } = dto;
    const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        branchId,
        ...(pinHash ? { pin: pinHash } : {}),
      },
    });
    const {
      passwordHash: _passwordHash,
      pin: _pin,
      refreshToken: _refreshToken,
      ...safeUser
    } = user;
    return safeUser;
  }

  async remove(id: string, actor?: UserActor) {
    const target = await this.getExistingUser(id);
    this.assertCanMutateUser(actor, target);
    await this.assertCanDeactivateLastSuperAdmin(target, false);
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const {
      passwordHash: _passwordHash,
      pin: _pin,
      refreshToken: _refreshToken,
      ...safeUser
    } = user;
    return safeUser;
  }

  private isSuperAdmin(actor?: Pick<UserActor, 'role'>) {
    return actor?.role === UserRoleEnum.SUPER_ADMIN;
  }

  private isAdmin(actor?: Pick<UserActor, 'role'>) {
    return actor?.role === UserRoleEnum.ADMIN;
  }

  private getReadBranchScope(
    actor?: Pick<UserActor, 'role' | 'branchId'>,
    requestedBranchId?: string,
  ) {
    if (this.isSuperAdmin(actor)) return requestedBranchId;
    if (!actor?.branchId) throw new BadRequestException('branchId is required');
    if (requestedBranchId && requestedBranchId !== actor.branchId) {
      throw new ForbiddenException(
        'No puedes administrar usuarios de otra sucursal',
      );
    }
    return actor.branchId;
  }

  private getWriteBranchScope(actor?: UserActor, requestedBranchId?: string) {
    if (this.isSuperAdmin(actor)) {
      const branchId = requestedBranchId ?? actor?.branchId;
      if (!branchId) throw new BadRequestException('branchId is required');
      return branchId;
    }
    if (!actor?.branchId) throw new BadRequestException('branchId is required');
    if (requestedBranchId && requestedBranchId !== actor.branchId) {
      throw new ForbiddenException(
        'No puedes administrar usuarios de otra sucursal',
      );
    }
    return actor.branchId;
  }

  private getUpdateBranchScope(
    actor: UserActor | undefined,
    target: ManagedUser,
    requestedBranchId?: string,
  ) {
    if (this.isSuperAdmin(actor)) {
      return (
        requestedBranchId ?? target.branchId ?? actor?.branchId ?? undefined
      );
    }
    if (!actor?.branchId) throw new BadRequestException('branchId is required');
    if (requestedBranchId && requestedBranchId !== actor.branchId) {
      throw new ForbiddenException(
        'No puedes administrar usuarios de otra sucursal',
      );
    }
    return actor.branchId;
  }

  private assertCanAccessUser(
    actor: Pick<UserActor, 'role' | 'branchId'> | undefined,
    target: ManagedUser,
  ) {
    if (this.isSuperAdmin(actor)) return;
    if (!actor?.branchId || target.branchId !== actor.branchId) {
      throw new ForbiddenException(
        'No puedes administrar usuarios de otra sucursal',
      );
    }
  }

  private assertCanMutateUser(
    actor: UserActor | undefined,
    target: ManagedUser,
  ) {
    this.assertCanAccessUser(actor, target);
    if (this.isAdmin(actor) && target.role === UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No puedes modificar un usuario SUPER_ADMIN',
      );
    }
  }

  private assertCanAssignRole(
    actor: UserActor | undefined,
    role: UserRoleEnum,
  ) {
    if (role === UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No tienes permiso para asignar el rol SUPER_ADMIN',
      );
    }
    if (this.isSuperAdmin(actor)) return;
    if (role === UserRoleEnum.CASHIER || role === UserRoleEnum.WAITER) return;
    throw new ForbiddenException('No tienes permiso para asignar ese rol');
  }

  private async assertCanDeactivateLastSuperAdmin(
    target: ManagedUser,
    nextIsActive?: boolean,
    nextRole?: UserRoleEnum,
  ) {
    const removesSuperAdminAccess =
      nextIsActive === false ||
      (nextRole !== undefined && nextRole !== UserRoleEnum.SUPER_ADMIN);
    if (target.role !== UserRoleEnum.SUPER_ADMIN || !removesSuperAdminAccess) {
      return;
    }
    const activeSuperAdmins = await this.prisma.user.count({
      where: {
        role: UserRoleEnum.SUPER_ADMIN,
        isActive: true,
        deletedAt: null,
      },
    });
    if (target.isActive && activeSuperAdmins <= 1) {
      throw new ForbiddenException(
        'No puedes desactivar o eliminar al ultimo SUPER_ADMIN activo',
      );
    }
  }

  private async getExistingUser(id: string): Promise<ManagedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, role: true, branchId: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
