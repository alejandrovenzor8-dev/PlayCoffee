import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChildAccessService } from './child-access.service';
import { CreateChildAccessDto } from './dto/create-child-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';

@ApiTags('Child Access')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.CASHIER)
@Controller('child-access')
export class ChildAccessController {
  constructor(private readonly childAccessService: ChildAccessService) {}

  @Get('active')
  findActive(
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.childAccessService.findActive(userBranchId ?? branchId);
  }

  @Get('overstaying')
  getOverstaying(
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.childAccessService.getOverstaying(userBranchId ?? branchId);
  }

  @Get()
  findAll(
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
  ) {
    return this.childAccessService.findAll(userBranchId ?? branchId);
  }

  @Post()
  register(
    @Body() dto: CreateChildAccessDto,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    const branchId = userBranchId ?? dto.branchId;
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.childAccessService.register(
      {
        ...dto,
        branchId,
      },
      userId,
    );
  }

  @Patch(':id/checkout')
  checkout(
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
    @CurrentUser('branchId') userBranchId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.childAccessService.checkout(
      id,
      userBranchId ?? branchId,
      userId,
    );
  }
}
