export function searchTerms(query: string): string[] {
  return query
    .replace(/[^\p{L}\p{N}+' ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
}
