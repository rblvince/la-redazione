import { webcrypto } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import {
  forgetInviteStep, forgetLoginStep, recallInviteStep, recallLoginStep, rememberInviteStep, rememberLoginStep,
} from '@/lib/domain/code-step';

afterEach(() => vi.unstubAllGlobals());

function session() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    crypto: webcrypto,
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
  return values;
}

test('il passo del login torna dopo un nuovo caricamento senza conservare il codice', () => {
  const values = session();
  rememberLoginStep('nome@example.test');
  expect(recallLoginStep()).toBe('nome@example.test');
  expect([...values.values()].join(' ')).not.toContain('12345678');
  expect(JSON.parse([...values.values()][0])).toEqual({ step: 'code', email: 'nome@example.test' });
  forgetLoginStep();
  expect(recallLoginStep()).toBeNull();
});

test('il passo dell’invito torna per lo stesso invito senza token o codice nello storage', async () => {
  const values = session();
  const token = 'a'.repeat(43);
  await rememberInviteStep(token);
  expect(await recallInviteStep(token)).toBe(true);
  expect(await recallInviteStep('b'.repeat(43))).toBe(false);
  expect([...values.keys()].join(' ')).not.toContain(token);
  expect([...values.values()]).toEqual(['{"step":"code"}']);
  expect([...values.values()].join(' ')).not.toContain('12345678');
  await forgetInviteStep(token);
  expect(await recallInviteStep(token)).toBe(false);
});

test('storage bloccato lascia i due percorsi utilizzabili', async () => {
  vi.stubGlobal('window', {
    crypto: webcrypto,
    get sessionStorage() { throw new Error('storage bloccato'); },
  });
  expect(() => rememberLoginStep('nome@example.test')).not.toThrow();
  expect(recallLoginStep()).toBeNull();
  expect(() => forgetLoginStep()).not.toThrow();
  await expect(rememberInviteStep('a'.repeat(43))).resolves.toBeUndefined();
  await expect(recallInviteStep('a'.repeat(43))).resolves.toBe(false);
  await expect(forgetInviteStep('a'.repeat(43))).resolves.toBeUndefined();
});
