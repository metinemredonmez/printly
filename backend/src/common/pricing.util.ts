import { Role } from '@prisma/client';

// USER 2× fiyattan alır; TEAM_MEMBER/TEAM_LEADER 1×. Admin/Production 1×.
export function multiplierForRole(role: Role | string): number {
  return role === Role.USER ? 2 : 1;
}

export const MEMBERSHIP_FEE = 30; // $/ay (Ekip Üyesi)
export const BULK_LOAD_FOR_DISCOUNT = 250; // $ → %40 indirim
