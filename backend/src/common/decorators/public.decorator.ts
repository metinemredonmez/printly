import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// JWT zorunluluğunu atlatmak için (login/register endpoint'leri).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
