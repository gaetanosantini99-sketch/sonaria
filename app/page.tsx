import type { CSSProperties } from 'react';
import { DemoForm } from './demo-form';

export const metadata = { title: 'Sonaria · 01.11.26' };

export default function HomePage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8" style={{ '--color-accent': '#2bff5a' } as CSSProperties}>
      <header className="space-y-2 text-center">
        <h1 className="text-5xl font-black uppercase tracking-wider text-accent">Sonaria</h1>
        <p className="text-sm font-bold uppercase tracking-widest">Selezione musicale · Degustazione vini</p>
        <p className="text-muted">Garage del Vino · Piazza Giuseppe Garibaldi 2, Spoleto (PG) · 01.11.26</p>
      </header>
      <DemoForm />
      <p className="text-center text-xs text-muted">Versione di prova: i dati inseriti non vengono salvati.</p>
    </main>
  );
}
