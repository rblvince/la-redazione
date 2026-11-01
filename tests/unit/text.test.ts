import { expect, test } from 'vitest';
import { cleanText, hasVisibleChar } from '@/lib/domain/text';

test('cleanText rimuove gli stessi spazi Unicode dagli estremi', () => {
  expect(cleanText('\u200b\u2800 Testo \u2060\u3164')).toBe('Testo');
  expect(cleanText(' \t\u200b\ufeff\u3164 ')).toBe('');
});

test('cleanText elabora una lunga sequenza interna in meno di 50 ms', () => {
  const input = `a${' '.repeat(200_000)}a`;
  const start = performance.now();
  const result = cleanText(input);
  const elapsed = performance.now() - start;
  expect(result).toBe(input);
  expect(elapsed).toBeLessThan(50);
}, 60_000);

test('hasVisibleChar distingue testo visibile da soli caratteri invisibili', () => {
  expect(hasVisibleChar('\u00ad\u200e')).toBe(false);
  expect(hasVisibleChar('\u034f\u115f\uffa0\u{e0020}')).toBe(false);
  expect(hasVisibleChar('\u2800')).toBe(false);
  expect(hasVisibleChar('\u0301')).toBe(false);
  for (const value of ['è', '🔥', '1']) expect(hasVisibleChar(value)).toBe(true);
});
