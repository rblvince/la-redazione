import { afterEach, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn(), redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { signInWithOtp: fake.signInWithOtp, verifyOtp: fake.verifyOtp, signOut: fake.signOut } }),
}));
vi.mock('next/navigation', () => ({ redirect: fake.redirect }));

import { loginAction, logoutAction, verifyLoginCodeAction } from '@/app/accedi/actions';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test('il login invia un codice e dà la stessa risposta per email esistenti o assenti', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.signInWithOtp.mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { message: 'User not found', code: 'user_not_found' } });
  const known = await loginAction('Esistente@example.test');
  const unknown = await loginAction('assente@example.test');
  expect(known).toEqual(unknown);
  expect(known).toEqual({ ok: true, message: 'Se l’email è invitata ti è arrivato un codice.' });
  expect(errorSpy).toHaveBeenCalledWith('[accedi] invio codice fallito: user_not_found');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('assente@example.test');
  expect(fake.signInWithOtp).toHaveBeenCalledWith({
    email: 'esistente@example.test', options: { shouldCreateUser: false },
  });
});

test('il login segnala solo il limite di invio, senza esporre email o dettagli', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.signInWithOtp.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429, message: 'private' } });
  expect(await loginAction('esistente@example.test')).toEqual({
    ok: false, message: 'Aspetta un minuto prima di chiedere un altro codice.',
  });
  expect(errorSpy).toHaveBeenCalledWith('[accedi] invio codice fallito: over_email_send_rate_limit');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('esistente@example.test');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('private');
});

test('il login riconosce il limite di invio anche dal solo status 429', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'private' } });
  expect(await loginAction('esistente@example.test')).toEqual({
    ok: false, message: 'Aspetta un minuto prima di chiedere un altro codice.',
  });
});

test('il login riconosce il limite di invio anche quando Supabase lo solleva', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.signInWithOtp.mockRejectedValue({ status: 429, code: 'over_email_send_rate_limit', message: 'private' });
  expect(await loginAction('esistente@example.test')).toEqual({
    ok: false, message: 'Aspetta un minuto prima di chiedere un altro codice.',
  });
});

test('il login respinge un indirizzo non valido senza chiamare Supabase', async () => {
  expect((await loginAction('non-email')).ok).toBe(false);
  expect(fake.signInWithOtp).not.toHaveBeenCalled();
});

test('il login registra eccezioni senza email e mantiene la risposta pubblica', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  fake.signInWithOtp.mockRejectedValueOnce(new Error('private detail'));
  await expect(loginAction('eccezione@example.test')).resolves.toEqual({
    ok: true, message: 'Se l’email è invitata ti è arrivato un codice.',
  });
  expect(errorSpy).toHaveBeenCalledWith('[accedi] invio codice fallito: eccezione');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('eccezione@example.test');
  expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('private detail');
});

test('verifica il codice sul client server e restituisce la destinazione', async () => {
  fake.verifyOtp.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
  expect(await verifyLoginCodeAction(' Esistente@example.test ', '12345678')).toEqual({ ok: true, redirect: '/' });
  expect(fake.verifyOtp).toHaveBeenCalledWith({ email: 'esistente@example.test', token: '12345678', type: 'email' });
});

test('verifica del codice respinge email e codice non validi prima di Supabase', async () => {
  expect((await verifyLoginCodeAction('non-email', '12345678')).ok).toBe(false);
  expect((await verifyLoginCodeAction('esistente@example.test', '12a45678')).ok).toBe(false);
  expect((await verifyLoginCodeAction('esistente@example.test', '123456')).ok).toBe(false);
  expect((await verifyLoginCodeAction('esistente@example.test', '123456789')).ok).toBe(false);
  expect(fake.verifyOtp).not.toHaveBeenCalled();
});

test('verifica del codice distingue errore generico e troppi tentativi', async () => {
  fake.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: { status: 400, code: 'otp_expired' } })
    .mockResolvedValueOnce({ data: { user: null }, error: { status: 429, code: 'over_request_rate_limit' } });
  expect(await verifyLoginCodeAction('esistente@example.test', '12345678')).toEqual({
    ok: false, message: 'Codice sbagliato o scaduto. Controlla l’ultima mail o chiedine uno nuovo.',
  });
  expect(await verifyLoginCodeAction('esistente@example.test', '12345678')).toEqual({
    ok: false, message: 'Troppi tentativi. Aspetta un minuto e riprova.',
  });
  expect(fake.redirect).not.toHaveBeenCalled();
});

test('verifica del codice riconosce anche il 429 sollevato da Supabase', async () => {
  fake.verifyOtp.mockRejectedValue({ status: 429 });
  expect(await verifyLoginCodeAction('esistente@example.test', '12345678')).toEqual({
    ok: false, message: 'Troppi tentativi. Aspetta un minuto e riprova.',
  });
});

test('logout revoca la sessione e torna ad accedi o a un invito interno', async () => {
  fake.signOut.mockResolvedValue({ error: null });
  fake.redirect.mockImplementation((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); });
  await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/accedi');
  await expect(logoutAction('/invito/token')).rejects.toThrow('NEXT_REDIRECT:/invito/token');
  await expect(logoutAction('//evil.example')).rejects.toThrow('NEXT_REDIRECT:/accedi');
  expect(fake.signOut).toHaveBeenCalledTimes(3);
});

test('logout non reindirizza quando signOut fallisce', async () => {
  fake.signOut.mockResolvedValue({ error: { message: 'private detail' } });
  expect(await logoutAction()).toEqual({ ok: false, message: expect.not.stringContaining('private detail') });
  expect(fake.redirect).not.toHaveBeenCalled();
});
