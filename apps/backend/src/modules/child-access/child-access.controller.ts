import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChildAccessService } from './child-access.service';
import { CreateChildAccessDto } from './dto/create-child-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Child Access')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('child-access')
export class ChildAccessController {
  constructor(private readonly childAccessService: ChildAccessService) {}

  @Get('active')
  findActive() { return this.childAccessService.findActive(); }

  @Get('overstaying')
  getOverstaying() { return this.childAccessService.getOverstaying(); }

  @Get()
  findAll() { return this.childAccessService.findAll(); }

  @Post()
  register(@Body() dto: CreateChildAccessDto) { return this.childAccessService.register(dto); }

  @Patch(':id/checkout')
  checkout(@Param('id') id: string) { return this.childAccessService.checkout(id); }
}
