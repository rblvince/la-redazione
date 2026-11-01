import { expect, test } from 'vitest';
import { voteSummary } from '@/components/topic/vote-summary';

const deciders = [
  { id: 'a', name: 'maintainer' },
  { id: 'b', name: 'Giulia' },
];

test('dice chi manca senza inventare la regola di passaggio', () => {
  expect(voteSummary([{ voter_id: 'a', value: true }], deciders)).toBe('1 sì · 0 no · manca Giulia');
});

test('conta sì e no e chiude quando hanno votato tutti', () => {
  expect(
    voteSummary(
      [
        { voter_id: 'a', value: true },
        { voter_id: 'b', value: false },
      ],
      deciders,
    ),
  ).toBe('1 sì · 1 no · hanno votato tutti');
});

test('ignora voti di chi non è decisore attivo e gestisce zero decisori', () => {
  expect(voteSummary([{ voter_id: 'zzz', value: true }], deciders)).toBe('0 sì · 0 no · manca maintainer, Giulia');
  expect(voteSummary([], [])).toBe('Nessun decisore attivo.');
});
