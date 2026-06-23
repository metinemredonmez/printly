'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Role } from './types';

export interface Me {
  userId: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me'),
    staleTime: 5 * 60_000,
  });
}
