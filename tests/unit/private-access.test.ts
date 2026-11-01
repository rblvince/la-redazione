import { expect, test } from 'vitest';
import { privateAccess } from '@/lib/domain/private-access';

test('distingue profilo attivo, inattivo ed errore di lettura', () => {
  expect(privateAccess({ active: true }, null)).toBe('ok');
  expect(privateAccess({ active: false }, null)).toBe('inattivo');
  expect(privateAccess(null, null)).toBe('inattivo');
  expect(privateAccess({ active: true }, new Error('query failed'))).toBe('errore');
  expect(privateAccess(null, new Error('query failed'))).toBe('errore');
});
