'use server';

import { cookies } from 'next/headers';

export async function setLocale(locale: 'tr' | 'en') {
  (await cookies()).set('od_locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 yıl
    sameSite: 'lax',
  });
}
