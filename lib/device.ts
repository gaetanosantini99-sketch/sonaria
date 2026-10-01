import { cookies } from 'next/headers';

const DEVICE_COOKIE = 'did';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function readDeviceId(): Promise<string | null> {
  const value = (await cookies()).get(DEVICE_COOKIE)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

// Da usare solo in Server Actions o Route Handlers (scrive un cookie)
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await readDeviceId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
