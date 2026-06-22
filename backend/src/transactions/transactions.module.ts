import { Module, Injectable, Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
  }
}

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.transactions.listMine(user.userId);
  }

  @Roles(Role.ADMIN)
  @Get()
  all() {
    return this.transactions.listAll();
  }
}

@Module({
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
