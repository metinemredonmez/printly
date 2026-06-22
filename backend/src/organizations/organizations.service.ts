import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, role: true, fullName: true } } },
    });
    if (!org) throw new NotFoundException('Firma bulunamadı');
    return org;
  }

  update(
    id: string,
    data: { name?: string; taxInfo?: string; slug?: string; theme?: Record<string, unknown> },
  ) {
    return this.prisma.organization.update({
      where: { id },
      data: { ...data, theme: data.theme as Prisma.InputJsonValue },
    });
  }
}
