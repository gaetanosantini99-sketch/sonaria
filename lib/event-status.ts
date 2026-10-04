export const EVENT_STATUSES = ['draft', 'live', 'closed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const STATUS_LABEL: Record<EventStatus, string> = { draft: 'Bozza', live: 'Attiva', closed: 'Chiusa' };
export const STATUS_ACTION_LABEL: Record<EventStatus, string> = { draft: 'Rimetti in bozza', live: 'Attiva', closed: 'Chiudi' };

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}
