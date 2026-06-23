import {
  Module,
  Injectable,
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  private isStaff(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.PRODUCTION;
  }

  // Global arama — rol kapsamına göre. Bayi yalnız kendi siparişlerini görür.
  async search(user: AuthUser, q: string) {
    const term = q.trim();
    if (term.length < 2) {
      throw new BadRequestException('En az 2 karakter girin');
    }
    const staff = this.isStaff(user);
    const like = { contains: term, mode: 'insensitive' as const };

    const [orders, products, tickets, users] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          archivedAt: null,
          ...(staff ? {} : { userId: user.userId }),
          OR: [{ orderNumber: like }, { clientName: like }, { etsyOrderNo: like }],
        },
        select: {
          id: true,
          orderNumber: true,
          clientName: true,
          status: true,
          total: true,
        },
        take: 15,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.findMany({
        where: { active: true, name: like },
        select: { id: true, name: true, category: true },
        take: 10,
      }),
      this.prisma.ticket.findMany({
        where: {
          ...(staff ? {} : { userId: user.userId }),
          subject: like,
        },
        select: { id: true, subject: true, status: true },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      // Kullanıcı araması yalnız staff
      staff
        ? this.prisma.user.findMany({
            where: { OR: [{ email: like }, { fullName: like }] },
            select: { id: true, email: true, fullName: true, role: true },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    return {
      query: term,
      results: { orders, products, tickets, users },
      counts: {
        orders: orders.length,
        products: products.length,
        tickets: tickets.length,
        users: users.length,
      },
    };
  }
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  do(@CurrentUser() user: AuthUser, @Query('q') q = '') {
    return this.search.search(user, q);
  }
}

@Module({
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
