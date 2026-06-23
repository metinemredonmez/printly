import {
  Module,
  Injectable,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Role, TicketStatus, TicketPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class CreateTicketDto {
  @IsString() @MinLength(3) subject: string;
  @IsString() @MinLength(1) body: string;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsString() orderId?: string;
}

class AddMessageDto {
  @IsString() @MinLength(1) body: string;
  @IsOptional() @IsBoolean() internal?: boolean; // yalnız staff
}

class UpdateTicketDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsString() assignedToUserId?: string;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private isStaff(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.PRODUCTION;
  }

  async create(user: AuthUser, dto: CreateTicketDto) {
    const ticket = await this.prisma.ticket.create({
      data: {
        subject: dto.subject,
        priority: dto.priority ?? TicketPriority.NORMAL,
        userId: user.userId,
        organizationId: user.organizationId ?? undefined,
        orderId: dto.orderId,
        messages: {
          create: { authorUserId: user.userId, body: dto.body, internal: false },
        },
      },
      include: { messages: true },
    });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'TICKET_CREATE',
      entityType: 'Ticket',
      entityId: ticket.id,
      meta: { subject: ticket.subject },
    });
    return ticket;
  }

  list(user: AuthUser, status?: TicketStatus) {
    return this.prisma.ticket.findMany({
      where: {
        status,
        ...(this.isStaff(user) ? {} : { userId: user.userId }),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async get(user: AuthUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Talep bulunamadı');
    const staff = this.isStaff(user);
    if (!staff && ticket.userId !== user.userId) {
      throw new ForbiddenException('Bu talebe erişiminiz yok');
    }
    // internal mesajları staff olmayan görmez
    if (!staff) {
      ticket.messages = ticket.messages.filter((m) => !m.internal);
    }
    return ticket;
  }

  async addMessage(user: AuthUser, id: string, dto: AddMessageDto) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Talep bulunamadı');
    const staff = this.isStaff(user);
    if (!staff && ticket.userId !== user.userId) {
      throw new ForbiddenException('Bu talebe erişiminiz yok');
    }
    if (dto.internal && !staff) {
      throw new ForbiddenException('İç not yalnız personel ekleyebilir');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Kapalı talebe mesaj eklenemez');
    }
    const msg = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorUserId: user.userId,
        body: dto.body,
        internal: dto.internal ?? false,
      },
    });
    // müşteri yazınca OPEN/PENDING'e çek; staff yanıtında PENDING
    await this.prisma.ticket.update({
      where: { id },
      data: { status: staff ? TicketStatus.PENDING : TicketStatus.OPEN },
    });
    return msg;
  }

  // Staff: durum/öncelik/atama
  async update(user: AuthUser, id: string, dto: UpdateTicketDto) {
    if (!this.isStaff(user)) {
      throw new ForbiddenException('Yalnız personel güncelleyebilir');
    }
    const ticket = await this.prisma.ticket.update({ where: { id }, data: dto });
    await this.audit.log({
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'TICKET_UPDATE',
      entityType: 'Ticket',
      entityId: id,
      meta: { ...dto },
    });
    return ticket;
  }
}

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: TicketStatus) {
    return this.tickets.list(user, status);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tickets.get(user, id);
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.tickets.addMessage(user, id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(user, id, dto);
  }
}

@Module({
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
