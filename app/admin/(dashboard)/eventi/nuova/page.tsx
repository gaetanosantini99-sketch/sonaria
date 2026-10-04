import { requireAdmin } from '@/lib/auth';
import { createEvent } from '../actions';
import { EventForm } from '../event-form';

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nuova serata</h1>
      <EventForm action={createEvent} pinRequired submitLabel="Crea serata" />
    </div>
  );
}
