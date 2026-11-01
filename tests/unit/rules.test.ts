import { describe, expect, test } from 'vitest';
import { decisionOutcome } from '@/lib/domain/rules';

describe('decisionOutcome', () => {
  test.each([
    ['unanimita', 2, 2, 0, 'passa'],
    ['unanimita', 2, 1, 0, 'in_discussione'],
    ['unanimita', 2, 1, 1, 'in_discussione'],
    ['maggioranza', 3, 2, 1, 'passa'],
    ['maggioranza', 4, 2, 0, 'in_discussione'],
    ['unanimita', 0, 0, 0, 'in_discussione'],
    ['maggioranza', 0, 0, 0, 'in_discussione'],
  ] as const)('%s: %i decisori, %i sì, %i no → %s', (rule, deciders, yes, no, expected) => {
    expect(decisionOutcome(rule, deciders, yes, no)).toBe(expected);
  });
});
