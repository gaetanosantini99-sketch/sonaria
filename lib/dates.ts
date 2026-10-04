import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TIME_ZONE = 'Europe/Rome';

export function romeLocalToUtcIso(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Data non valida');
  return fromZonedTime(local, TIME_ZONE).toISOString();
}

export function utcToRomeLocalInput(iso: string): string {
  return formatInTimeZone(iso, TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}

export function formatRome(iso: string, pattern = 'dd/MM/yyyy HH:mm'): string {
  return formatInTimeZone(iso, TIME_ZONE, pattern);
}
