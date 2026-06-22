import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { Role } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

class UpdateOrgDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() taxInfo?: string;
  // subdomain: yalnız a-z0-9- , 3-40 karakter (reserved kelimeler serviste reddedilir — M5)
  @IsOptional()
  @Matches(/^[a-z0-9-]{3,40}$/, {
    message: 'slug yalnız küçük harf, rakam ve tire içerebilir (3-40 karakter)',
  })
  slug?: string;
  @IsOptional() theme?: Record<string, unknown>; // branding
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

  // Firma profilini yalnız Ekip Lideri veya Admin düzenleyebilir (USER yazamaz — M5)
  @Roles(Role.TEAM_LEADER, Role.ADMIN)
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
