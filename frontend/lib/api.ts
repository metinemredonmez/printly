// İstemci API katmanı — Next route handler proxy'sine (/api/be/*) çağırır.
// Token httpOnly cookie'de; istemci JS token'ı görmez (XSS dayanıklı).

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Opts = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(`/api/be/${path.replace(/^\//, '')}`, {
    ...opts,
    headers,
    body,
    credentials: 'same-origin',
  });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = Array.isArray((data as { message?: unknown })?.message)
      ? ((data as { message: string[] }).message[0])
      : ((data as { message?: string })?.message ?? 'Bir hata oluştu');
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

// Auth (cookie set/clear → ayrı route handler'lar)
export async function login(email: string, password: string, code?: string, rememberMe?: boolean) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, ...(code ? { code } : {}), ...(rememberMe ? { rememberMe: true } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Giriş başarısız', res.status, data);
  }
  return data.user;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
}
