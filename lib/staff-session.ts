import { cookies } from 'next/headers';
import { decodeStaffSession, encodeStaffSession, type StaffSession } from './staff-session-codec';

const COOKIE = 'staff_session';

export async function getStaffSession(): Promise<StaffSession | null> {
  return decodeStaffSession((await cookies()).get(COOKIE)?.value);
}

export async function setStaffSession(session: StaffSession): Promise<void> {
  (await cookies()).set(COOKIE, encodeStaffSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/v',
    maxAge: 12 * 60 * 60,
  });
}

export async function clearStaffSession(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: '/v' });
}
