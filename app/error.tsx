'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Si è verificato un errore</h1>
      <p className="text-muted">Riprova tra qualche istante.</p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>Riprova</button>
    </main>
  );
}
