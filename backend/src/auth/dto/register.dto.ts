import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

// Bireysel satıcı (USER) kaydı. Org opsiyonel (çok-kullanıcılı firma isteyen için).
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;
}
