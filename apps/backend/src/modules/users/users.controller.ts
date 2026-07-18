import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Query('branchId') branchId?: string,
    @CurrentUser() user?: { role: UserRoleEnum; branchId?: string },
  ) {
    return this.usersService.findAll(user, branchId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: { role: UserRoleEnum; branchId?: string },
  ) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser()
    user?: { id: string; role: UserRoleEnum; branchId?: string },
  ) {
    return this.usersService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser()
    user?: { id: string; role: UserRoleEnum; branchId?: string },
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser()
    user?: { id: string; role: UserRoleEnum; branchId?: string },
  ) {
    return this.usersService.remove(id, user);
  }
}
