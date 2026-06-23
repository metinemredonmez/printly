import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateStatusDto } from './dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Sipariş oluşturma izni — PRODUCTION'da YOK (yalnız müşteri rolleri + admin)
  @RequirePermission('order:create')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  @RequirePermission('order:read')
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('archived') archived?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orders.findAll(user, {
      archived: archived === 'true',
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  // Üretim-öncesi onay (personel) — H2/#33
  @RequirePermission('order:updateStatus')
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.approve(user, id);
  }

  // Arşivle / arşivden çıkar (personel) — #13
  @RequirePermission('order:updateStatus')
  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.setArchived(user, id, true);
  }

  @RequirePermission('order:updateStatus')
  @Post(':id/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.setArchived(user, id, false);
  }

  @RequirePermission('order:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.findOne(user, id);
  }

  // Durum değiştirme: 'order:updateStatus' izni (ADMIN '*' + PRODUCTION)
  @RequirePermission('order:updateStatus')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.orders.updateStatus(user, id, dto.status, dto.note);
  }
}
