import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:3001/api';

// E-posta OTP doğrulama → backend {accessToken,user} döner → cookie'ye yaz (oto giriş).
export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/auth/verify-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(data, { status: res.ok ? 400 : res.status });
  }
  (await cookies()).set('od_token', data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return NextResponse.json({ user: data.user });
}
