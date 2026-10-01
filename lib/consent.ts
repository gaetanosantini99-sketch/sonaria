import { formatRome } from '@/lib/dates';

export function consentLabel(until: string | null, now: Date): string {
  if (!until || Date.parse(until) <= now.getTime()) return 'Non attivo';
  return `Fino al ${formatRome(until, 'dd/MM/yyyy')}`;
}
