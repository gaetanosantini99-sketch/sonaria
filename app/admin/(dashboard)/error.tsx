'use client';

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card space-y-3">
      <p className="font-bold">Qualcosa è andato storto</p>
      <p className="text-sm text-muted">{error.message}</p>
      <button className="btn btn-secondary" onClick={reset}>Riprova</button>
    </div>
  );
}
