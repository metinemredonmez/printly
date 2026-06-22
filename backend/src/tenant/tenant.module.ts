import {
  Module,
  Injectable,
  NestMiddleware,
  Controller,
  Get,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

export interface TenantInfo {
  id: string;
  slug: string | null;
  name: string;
  theme: unknown;
}

// Subdomain (bayi1.ortakdoku.com) veya X-Tenant header → tenant çöz, req.tenant'a koy.
// NOT: tam veri-izolasyon enforcement'ı sonraki faz; bu katman çözümleme + branding sağlar.
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: any, _res: any, next: () => void) {
    const host = ((req.headers['host'] as string) || '').split(':')[0];
    const header = (req.headers['x-tenant'] || req.headers['x-tenant-slug']) as string | undefined;
    let slug = header;
    if (!slug && host) {
      const parts = host.split('.');
      if (parts.length >= 3) slug = parts[0]; // sub.domain.tld
    }
    if (slug && !['www', 'app', 'api', 'localhost'].includes(slug)) {
      const org = await this.prisma.organization.findUnique({ where: { slug } });
      if (org) {
        req.tenant = { id: org.id, slug: org.slug, name: org.name, theme: org.theme };
      }
    }
    next();
  }
}

export const CurrentTenant = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().tenant ?? null,
);

@Controller('tenant')
export class TenantController {
  // Frontend branding için (subdomain'den çözülen tenant)
  @Public()
  @Get('current')
  current(@CurrentTenant() tenant: TenantInfo | null) {
    return tenant;
  }
}

@Module({
  providers: [TenantMiddleware],
  controllers: [TenantController],
})
export class TenantModule {}
