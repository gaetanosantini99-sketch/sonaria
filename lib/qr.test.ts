import { describe, expect, it } from 'vitest';
import { qrPng, qrSvg } from './qr';

describe('qr', () => {
  it('genera un SVG', async () => {
    expect((await qrSvg('https://example.it/e/x')).trim().startsWith('<svg')).toBe(true);
  });
  it('genera un PNG', async () => {
    const png = await qrPng('https://example.it/e/x');
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
