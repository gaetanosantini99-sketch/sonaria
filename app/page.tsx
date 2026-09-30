import { SITE_NAME } from '@/lib/site';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-black">{SITE_NAME}</h1>
      <p className="mt-2 text-muted">Sito in arrivo.</p>
    </main>
  );
}
