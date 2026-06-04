import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto, UpdateAreaDto, ReorderAreasDto } from './dto';

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtener todas las áreas de una sucursal
   */
  async findAll(branchId: string) {
    return this.prisma.tableArea.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      include: {
        tables: {
          where: { deletedAt: null },
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
        _count: {
          select: { tables: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Obtener áreas activas
   */
  async findActive(branchId: string) {
    return this.prisma.tableArea.findMany({
      where: {
        branchId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { tables: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Obtener un área por ID
   */
  async findOne(id: string) {
    const area = await this.prisma.tableArea.findUnique({
      where: { id, deletedAt: null },
      include: {
        tables: {
          where: { deletedAt: null },
        },
        _count: {
          select: { tables: true },
        },
      },
    });

    if (!area) {
      throw new NotFoundException(`Área con ID ${id} no encontrada`);
    }

    return area;
  }

  /**
   * Crear nueva área
   */
  async create(branchId: string, dto: CreateAreaDto) {
    // Si no se proporciona orden, obtener el siguiente disponible
    if (dto.order === undefined) {
      const lastArea = await this.prisma.tableArea.findFirst({
        where: { branchId, deletedAt: null },
        orderBy: { order: 'desc' },
      });
      dto.order = lastArea ? lastArea.order + 1 : 0;
    }

    return this.prisma.tableArea.create({
      data: {
        ...dto,
        branchId,
      },
      include: {
        _count: {
          select: { tables: true },
        },
      },
    });
  }

  /**
   * Actualizar área
   */
  async update(id: string, dto: UpdateAreaDto) {
    await this.findOne(id);

    return this.prisma.tableArea.update({
      where: { id },
      data: dto,
      include: {
        _count: {
          select: { tables: true },
        },
      },
    });
  }

  /**
   * Reordenar áreas
   */
  async reorder(branchId: string, dto: ReorderAreasDto) {
    // Verificar que todas las áreas pertenezcan a la sucursal
    const areas = await this.prisma.tableArea.findMany({
      where: {
        id: { in: dto.areaIds },
        branchId,
        deletedAt: null,
      },
    });

    if (areas.length !== dto.areaIds.length) {
      throw new BadRequestException('Algunas áreas no existen o no pertenecen a esta sucursal');
    }

    // Actualizar el orden de cada área
    const updates = dto.areaIds.map((areaId, index) =>
      this.prisma.tableArea.update({
        where: { id: areaId },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll(branchId);
  }

  /**
   * Eliminar área (soft delete)
   */
  async remove(id: string) {
    const area = await this.findOne(id);

    // Verificar que no tenga mesas activas
    if (area._count.tables > 0) {
      throw new BadRequestException('No se puede eliminar un área que tiene mesas asignadas');
    }

    return this.prisma.tableArea.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Alternar estado activo/inactivo
   */
  async toggleActive(id: string) {
    const area = await this.findOne(id);

    return this.prisma.tableArea.update({
      where: { id },
      data: { isActive: !area.isActive },
    });
  }
}
