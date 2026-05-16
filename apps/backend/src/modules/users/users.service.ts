import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, branchId: true, isActive: true, createdAt: true, phone: true, avatarUrl: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, branchId: true, isActive: true, createdAt: true, phone: true, avatarUrl: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const { password, pin, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 12);
    const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;

    const user = await this.prisma.user.create({
      data: { ...rest, passwordHash, pin: pinHash },
    });

    const { passwordHash: _ph, pin: _pin, refreshToken: _rt, ...safeUser } = user;
    return safeUser;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const { pin, ...rest } = dto;
    const pinHash = pin ? await bcrypt.hash(pin, 10) : undefined;
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...rest, ...(pinHash ? { pin: pinHash } : {}) },
    });
    const { passwordHash, pin: _p, refreshToken, ...safeUser } = user;
    return safeUser;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
