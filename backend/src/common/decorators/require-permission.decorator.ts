import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
// Rol üstü ince yetki: @RequirePermission('order:updateStatus')
export const RequirePermission = (...perms: string[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
