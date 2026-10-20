import type { CSSProperties } from 'react';
import Image from 'next/image';
import locandina from '@/public/locandina-sonaria.jpg';
import { DemoForm } from './demo-form';

export const metadata = { title: 'Sonaria · 01.11.26' };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8" style={{ '--color-accent': '#2bff5a' } as CSSProperties}>
      <h1 className="sr-only">Sonaria · Degustazione sonora</h1>
      <Image
        src={locandina}
        alt="Sonaria, degustazione sonora. Il Garage del Vino, Piazza Giuseppe Garibaldi 2, Spoleto (PG). Dal 01 al 29.11.26, ore 19:30."
        preload
        placeholder="blur"
        sizes="(max-width: 448px) 100vw, 448px"
        className="h-auto w-full rounded-2xl"
      />
      <DemoForm />
      <p className="text-center text-xs text-muted">Versione di prova: i dati inseriti non vengono salvati.</p>
    </main>
  );
}
