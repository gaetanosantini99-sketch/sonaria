import { createHash } from 'node:crypto';

export function getClientIp(headers: Headers): string | null {
  const netlify = headers.get('x-nf-client-connection-ip');
  if (netlify) return netlify.trim();
  const forwarded = headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || null;
}

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
