// Genera il QR da inviare insieme alla locandina (immagine separata).
// Uso: node scripts/make-qr.ts https://sonaria.uk/
import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';

const url = process.argv[2];
if (!url) {
  console.error('Manca l\'URL: node scripts/make-qr.ts https://dominio/');
  process.exit(1);
}

// Moduli scuri su verde: polarita' normale, letta da tutte le fotocamere, e coerente con la locandina.
const opts = { margin: 4, errorCorrectionLevel: 'M', color: { dark: '#050505', light: '#2bff5a' } } as const;
await writeFile('demo/qr-sonaria.png', await QRCode.toBuffer(url, { ...opts, type: 'png', width: 1200 }));
await writeFile('demo/qr-sonaria.svg', await QRCode.toString(url, { ...opts, type: 'svg' }));
console.log(`QR scritto in demo/qr-sonaria.png e .svg -> ${url}`);
