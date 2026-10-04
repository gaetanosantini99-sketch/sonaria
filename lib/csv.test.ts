import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('celle semplici e vuote', () => {
    expect(csvCell('Mario')).toBe('Mario');
    expect(csvCell(5)).toBe('5');
    expect(csvCell(null)).toBe('');
  });
  it('mette tra virgolette separatori, virgolette e a capo', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('di "Mario"')).toBe('"di ""Mario"""');
    expect(csvCell('riga1\nriga2')).toBe('"riga1\nriga2"');
  });
  it('neutralizza le formule per Excel', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+393331234567')).toBe("'+393331234567");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
  });
  it('BOM, intestazioni e CRLF', () => {
    const csv = toCsv([{ n: 'Anna' }], [{ header: 'Nome', value: (r) => r.n }]);
    expect(csv).toBe('\uFEFFNome\r\nAnna\r\n');
  });
});
