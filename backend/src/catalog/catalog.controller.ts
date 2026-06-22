import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateMaterialDto,
  UpdateMaterialDto,
  CreateProductDto,
  UpdateProductDto,
  CreateExtraOptionDto,
} from './dto';

// Okuma: tüm giriş yapmış kullanıcılar. Yazma: yalnızca ADMIN.
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // Materials
  @Get('materials')
  listMaterials() {
    return this.catalog.listMaterials();
  }

  @Roles(Role.ADMIN)
  @Post('materials')
  createMaterial(@Body() dto: CreateMaterialDto) {
    return this.catalog.createMaterial(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('materials/:id')
  updateMaterial(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.catalog.updateMaterial(id, dto);
  }

  // Products
  @Get('products')
  listProducts() {
    return this.catalog.listProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalog.getProduct(id);
  }

  @Roles(Role.ADMIN)
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(id, dto);
  }

  // Extra options (Shipping Box / Installation Kit / Sample)
  @Get('extras')
  listExtras() {
    return this.catalog.listExtras();
  }

  @Roles(Role.ADMIN)
  @Post('extras')
  createExtra(@Body() dto: CreateExtraOptionDto) {
    return this.catalog.createExtra(dto);
  }

  @Roles(Role.ADMIN)
  @Delete('extras/:id')
  deleteExtra(@Param('id') id: string) {
    return this.catalog.deleteExtra(id);
  }
}
