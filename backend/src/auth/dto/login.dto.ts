import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  // 2FA açıksa zorunlu (TOTP veya yedek kod)
  @IsOptional()
  @IsString()
  code?: string;

  // Beni hatırla → JWT + cookie 30 gün (yoksa 1 gün / oturum)
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
