const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

export function searchTerms(query: string): string[] {
  return query
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+' ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
}
