import { Role } from '@prisma/client';

// Rol üstüne ince yetkiler. '*' = tüm izinler (ADMIN).
export const ALL_PERMISSIONS = '*';

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [ALL_PERMISSIONS],
  PRODUCTION: [
    'order:read',
    'order:updateStatus',
    'board:manage',
    'file:download',
    'notification:read',
  ],
  TEAM_LEADER: ['order:read', 'order:create', 'member:read', 'credit:topup'],
  TEAM_MEMBER: ['order:read', 'order:create', 'credit:topup'],
  USER: ['order:read', 'order:create', 'credit:topup'],
};

export function permissionsForRole(role: Role | string): string[] {
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

export function hasPermission(role: Role | string, perm: string): boolean {
  const perms = permissionsForRole(role);
  return perms.includes(ALL_PERMISSIONS) || perms.includes(perm);
}
