import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Products')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.productsService.findAll(categoryId, search);
  }

  @Get('categories')
  findCategories() { return this.productsService.findAllCategories(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.productsService.findOne(id); }

  @Post()
  create(@Body() dto: CreateProductDto) { return this.productsService.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.productsService.remove(id); }
}
