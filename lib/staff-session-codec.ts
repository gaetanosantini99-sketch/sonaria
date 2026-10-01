export type StaffSession = { staffToken: string; sessionKey: string };

export function encodeStaffSession(session: StaffSession): string {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

export function decodeStaffSession(value: string | undefined): StaffSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<StaffSession>;
    if (typeof parsed.staffToken === 'string' && typeof parsed.sessionKey === 'string') {
      return { staffToken: parsed.staffToken, sessionKey: parsed.sessionKey };
    }
  } catch {
    // cookie corrotto
  }
  return null;
}
