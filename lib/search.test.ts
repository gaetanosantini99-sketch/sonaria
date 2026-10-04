import { describe, expect, it } from 'vitest';
import { searchTerms } from './search';

describe('searchTerms', () => {
  it('divide in parole', () => {
    expect(searchTerms('  Mario   Rossi ')).toEqual(['mario', 'rossi']);
  });
  it('conserva apostrofi, accenti e +', () => {
    expect(searchTerms("d'Angelo Niccolò +39333")).toEqual(["d'angelo", 'niccolo', '+39333']);
  });
  it('toglie i caratteri che rompono i filtri', () => {
    expect(searchTerms('a,b(c)')).toEqual(['a', 'b', 'c']);
    expect(searchTerms('%_*')).toEqual([]);
  });
  it('massimo 3 parole', () => {
    expect(searchTerms('a b c d')).toEqual(['a', 'b', 'c']);
  });
});
