import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:3001/api';

// Login → backend'e iletir, başarılıysa accessToken'ı httpOnly cookie'ye yazar.
export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(data, { status: res.ok ? 401 : res.status });
  }
  (await cookies()).set('od_token', data.accessToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true', // SSL gelince COOKIE_SECURE=true; HTTP'de secure cookie tarayıcıda düşer
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 gün (JWT ile aynı)
  });
  return NextResponse.json({ user: data.user });
}
