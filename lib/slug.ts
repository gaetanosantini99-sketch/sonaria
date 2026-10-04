const SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function randomSuffix(length = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('');
}

export function makeEventSlug(title: string, suffix = randomSuffix()): string {
  return `${slugify(title) || 'serata'}-${suffix}`;
}
