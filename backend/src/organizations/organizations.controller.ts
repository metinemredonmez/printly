import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() taxInfo?: string;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  // Admin: tüm bayiler
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.orgs.findAll();
  }

  // Bayinin kendi firma profili
  @Get('me')
  myOrg(@CurrentUser() user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('Firma bağlantınız yok');
    return this.orgs.findOne(user.organizationId);
  }

  @Patch('me')
  updateMyOrg(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrgDto) {
    if (!user.organizationId) throw new ForbiddenException('Firma bağlantınız yok');
    return this.orgs.update(user.organizationId, dto);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgs.findOne(id);
  }
}
