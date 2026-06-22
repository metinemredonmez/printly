import { IsEmail, IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  // 2FA açıksa zorunlu (TOTP veya yedek kod)
  @IsOptional()
  @IsString()
  code?: string;
}
