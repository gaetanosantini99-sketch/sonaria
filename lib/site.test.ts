import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from './site';

describe('siteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('unisce base e path senza doppi slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.it/');
    expect(siteUrl('/e/abc')).toBe('https://example.it/e/abc');
  });

  it('aggiunge lo slash mancante', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.it');
    expect(siteUrl('c/x')).toBe('https://example.it/c/x');
  });

  it('usa localhost se la variabile è vuota', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl()).toBe('http://localhost:3000/');
  });
});
