import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  // Her istekte kullanıcıyı DB'den TAZE doğrula:
  // - deaktive edilen hesabın token'ı anında geçersiz (H1 stale session)
  // - rol DB'den alınır → rol değişimi anında etkili (M8 desenkronizasyon)
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        active: true,
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Hesap erişimi geçersiz');
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}
