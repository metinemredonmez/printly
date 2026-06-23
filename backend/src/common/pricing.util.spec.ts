import { Role } from '@prisma/client';
import {
  multiplierForRole,
  MEMBERSHIP_FEE,
  BULK_LOAD_FOR_DISCOUNT,
} from './pricing.util';

describe('pricing.util — rol çarpanı + sabitler', () => {
  it('USER 2×, diğer roller 1×', () => {
    expect(multiplierForRole(Role.USER)).toBe(2);
    expect(multiplierForRole(Role.TEAM_MEMBER)).toBe(1);
    expect(multiplierForRole(Role.TEAM_LEADER)).toBe(1);
    expect(multiplierForRole(Role.ADMIN)).toBe(1);
    expect(multiplierForRole(Role.PRODUCTION)).toBe(1);
  });

  it('iş kuralı sabitleri', () => {
    expect(MEMBERSHIP_FEE).toBe(30); // $30/ay aidat
    expect(BULK_LOAD_FOR_DISCOUNT).toBe(250); // $250 → %40 indirim eşiği
  });
});
