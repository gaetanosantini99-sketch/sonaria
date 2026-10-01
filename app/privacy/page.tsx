import { DATA_CONTROLLER, PRIVACY_VERSION } from '@/lib/privacy';

export const metadata = { title: 'Informativa privacy' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10 leading-relaxed">
      <h1 className="text-2xl font-bold">Informativa privacy</h1>
      <p className="text-sm text-muted">Versione {PRIVACY_VERSION} — bozza da validare con un consulente privacy.</p>
      <h2 className="font-bold">Titolare</h2>
      <p>{DATA_CONTROLLER.name} — {DATA_CONTROLLER.email}</p>
      <h2 className="font-bold">Dati raccolti</h2>
      <p>
        Nome, cognome, numero di telefono (facoltativo), data e ora dei consensi, un identificativo tecnico del dispositivo
        (cookie) usato per evitare coupon duplicati e un&apos;impronta non reversibile dell&apos;indirizzo IP usata contro gli abusi.
      </p>
      <h2 className="font-bold">Finalità</h2>
      <p>1) Emettere e verificare il coupon della serata. 2) Solo con il tuo consenso, inviarti offerte dedicate per 30 giorni dall&apos;ultima registrazione.</p>
      <h2 className="font-bold">Conservazione</h2>
      <p>I dati vengono cancellati dopo 12 mesi senza nuove registrazioni. Il consenso alle offerte scade dopo 30 giorni.</p>
      <h2 className="font-bold">Destinatari</h2>
      <p>I dati sono ospitati da fornitori infrastrutturali (database e hosting). Gli sponsor delle offerte non ricevono i tuoi dati.</p>
      <h2 className="font-bold">I tuoi diritti</h2>
      <p>
        Puoi chiedere accesso, rettifica, cancellazione o revocare il consenso scrivendo a {DATA_CONTROLLER.email}. Puoi proporre
        reclamo al Garante per la protezione dei dati personali.
      </p>
    </main>
  );
}
