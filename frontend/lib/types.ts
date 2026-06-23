export type Role = 'USER' | 'TEAM_MEMBER' | 'TEAM_LEADER' | 'ADMIN' | 'PRODUCTION';

export interface User {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
  fullName?: string;
  balance?: number;
  hasDiscount40?: boolean;
  priceMultiplier?: number;
}

export const STAFF_ROLES: Role[] = ['ADMIN', 'PRODUCTION'];
export const isStaff = (r?: Role | null) => !!r && STAFF_ROLES.includes(r);
export const homeFor = (r?: Role | null) => (isStaff(r) ? '/admin' : '/app');
