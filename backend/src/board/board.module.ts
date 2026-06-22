import {
  Module,
  Injectable,
  Controller,
  Get,
  Patch,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { refundOnCancel } from '../common/refund.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  IN_PRODUCTION: [OrderStatus.AWAITING_APPROVAL, OrderStatus.READY, OrderStatus.CANCELLED],
  AWAITING_APPROVAL: [OrderStatus.IN_PRODUCTION, OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [],
  CANCELLED: [],
};

const COLUMNS: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.AWAITING_APPROVAL,
  OrderStatus.READY,
  OrderStatus.SHIPPED,
];

class MoveDto {
  @IsEnum(OrderStatus) toStatus: OrderStatus;
  @IsInt() @Min(0) position: number;
}

class ReorderItem {
  @IsString() id: string;
  @IsInt() @Min(0) position: number;
}
class ReorderDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReorderItem) items: ReorderItem[];
}

@Injectable()
export class BoardService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getBoard() {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: COLUMNS } },
      orderBy: [{ boardPosition: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        _count: { select: { items: true, assets: true } },
      },
    });

    const now = Date.now();
    const columns = COLUMNS.map((status) => {
      const cards = orders
        .filter((o) => o.status === status)
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          category: o.category,
          productType: o.productType,
          totalSqm: Number(o.totalSqm),
          total: Number(o.total),
          paymentStatus: o.paymentStatus,
          dealer: o.user?.fullName || o.user?.email,
          itemCount: o._count.items,
          assetCount: o._count.assets,
          boardPosition: o.boardPosition,
          ageHours: Math.round((now - o.updatedAt.getTime()) / 3600000),
        }));
      return { status, count: cards.length, cards };
    });
    return { columns };
  }

  // Kartı başka kolona/pozisyona taşı.
  async move(authUser: AuthUser, orderId: string, toStatus: OrderStatus, position: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');

    const statusChanged = order.status !== toStatus;
    if (statusChanged && !TRANSITIONS[order.status].includes(toStatus)) {
      throw new BadRequestException(`Geçersiz geçiş: ${order.status} → ${toStatus}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Board'dan iptale sürüklenirse de BALANCE+PAID siparişte atomik iade
      const didRefund = statusChanged
        ? await refundOnCancel(tx, order, toStatus)
        : false;
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          boardPosition: position,
          ...(didRefund ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
          statusEvents: statusChanged
            ? { create: { fromStatus: order.status, toStatus, byUserId: authUser.userId } }
            : undefined,
        },
      });
    });

    if (statusChanged) {
      await this.audit.log({
        actorUserId: authUser.userId,
        actorRole: authUser.role,
        action: 'ORDER_STATUS_CHANGE',
        entityType: 'Order',
        entityId: orderId,
        meta: { from: order.status, to: toStatus, via: 'board' },
      });
    }
    return updated;
  }

  // Kolon içi toplu sıralama (Pure pattern).
  async reorder(status: OrderStatus, items: ReorderItem[]) {
    await this.prisma.$transaction(
      items.map((it) =>
        this.prisma.order.update({
          where: { id: it.id },
          data: { boardPosition: it.position },
        }),
      ),
    );
    return { updated: items.length, status };
  }
}

@Controller('board')
export class BoardController {
  constructor(private readonly board: BoardService) {}

  @RequirePermission('board:manage')
  @Get()
  getBoard() {
    return this.board.getBoard();
  }

  @RequirePermission('board:manage')
  @Patch('orders/:id/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveDto,
  ) {
    return this.board.move(user, id, dto.toStatus, dto.position);
  }

  @RequirePermission('board:manage')
  @Patch('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.board.reorder(dto.status, dto.items);
  }
}

@Module({
  providers: [BoardService],
  controllers: [BoardController],
})
export class BoardModule {}
