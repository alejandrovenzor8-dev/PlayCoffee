import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreatePartyPackageDto,
  UpdatePartyPackageDto,
} from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Party Packages')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('party-packages')
export class PartyPackagesController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @Roles(UserRoleEnum.CASHIER)
  @ApiQuery({ name: 'includeInactive', required: false })
  findAll(
    @Query('includeInactive') includeInactive?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.findPackages(
      userBranchId,
      includeInactive === 'true',
    );
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN)
  create(
    @Body() dto: CreatePartyPackageDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.createPackage({
      ...dto,
      branchId: userBranchId ?? dto.branchId,
    });
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePartyPackageDto,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.updatePackage(id, dto, userBranchId);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.reservationsService.removePackage(id, userBranchId);
  }
}
