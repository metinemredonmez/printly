import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Backend proxy: cookie'deki JWT'yi Bearer olarak ekleyip NestJS'e iletir.
// Token istemci JS'e sızmaz. Tüm /api/be/* çağrıları buradan geçer.
const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:3001/api';

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const token = (await cookies()).get('od_token')?.value;
  const url = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(url, init);
  const buf = await upstream.arrayBuffer();
  const resHeaders = new Headers();
  const upCt = upstream.headers.get('content-type');
  if (upCt) resHeaders.set('content-type', upCt);
  const cd = upstream.headers.get('content-disposition');
  if (cd) resHeaders.set('content-disposition', cd);
  return new NextResponse(buf, { status: upstream.status, headers: resHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
