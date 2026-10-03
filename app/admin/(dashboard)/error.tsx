'use client';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card space-y-3">
      <p className="font-bold">Qualcosa è andato storto</p>
      <p className="text-sm text-muted">L&apos;operazione non è riuscita. Riprova tra qualche istante.</p>
      <button className="btn btn-secondary" onClick={reset}>Riprova</button>
    </div>
  );
}
