import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), getUser: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), signInWithOtp: vi.fn(), verifyOtp: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: fakes.rpc, from: fakes.from, auth: { admin: { listUsers: fakes.listUsers, createUser: fakes.createUser, deleteUser: fakes.deleteUser } } }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getUser: fakes.getUser, signInWithOtp: fakes.signInWithOtp, verifyOtp: fakes.verifyOtp } }),
}));

import { acceptInviteAction, peekInviteAction, startInviteLoginAction, verifyInviteCodeAction } from '@/app/invito/[token]/actions';

const token = 'a'.repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_URL', 'https://redazione.example.test');
  fakes.getUser.mockResolvedValue({ data: { user: null }, error: null });
  fakes.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  fakes.createUser.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
  fakes.deleteUser.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllEnvs());

test('inviti invalidi, usati, scaduti o revocati non creano account', async () => {
  for (const code of ['invito_non_valido', 'invito_usato', 'invito_scaduto']) {
    fakes.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
    const result = await acceptInviteAction(token, 'Nome');
    expect(result.ok).toBe(false);
    expect(fakes.createUser).not.toHaveBeenCalled();
    expect(fakes.listUsers).not.toHaveBeenCalled();
    vi.clearAllMocks();
  }
});

test('sessione con email diversa non crea account né riscatta', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.getUser.mockResolvedValue({ data: { user: { id: 'other-user', email: 'altra@example.test' } }, error: null });
  const result = await acceptInviteAction(token, 'Nome');
  expect(result).toMatchObject({ ok: false, message: expect.stringContaining('email') });
  expect(fakes.rpc).toHaveBeenCalledTimes(1);
  expect(fakes.createUser).not.toHaveBeenCalled();
  expect(fakes.signInWithOtp).not.toHaveBeenCalled();
});

test('senza sessione invia il codice e non riscatta l’invito', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.signInWithOtp.mockResolvedValue({ error: null });
  const result = await acceptInviteAction(token, 'Nome');
  expect(result).toEqual({ ok: true, message: 'Ti abbiamo mandato un codice di 8 cifre.' });
  expect(fakes.createUser).toHaveBeenCalledOnce();
  expect(fakes.rpc).toHaveBeenCalledTimes(1);
  expect(fakes.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
  expect(fakes.signInWithOtp).toHaveBeenCalledWith({
    email: 'giusta@example.test',
    options: { shouldCreateUser: false },
  });
  expect(fakes.deleteUser).not.toHaveBeenCalled();
});

test('utente Auth già esistente riceve il codice senza creare un account né riscattare', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.listUsers.mockResolvedValue({ data: { users: [{ id: 'existing-user', email: 'giusta@example.test' }] }, error: null });
  fakes.signInWithOtp.mockResolvedValue({ error: null });
  const result = await acceptInviteAction(token, 'Nome');
  expect(result.ok).toBe(true);
  expect(fakes.createUser).not.toHaveBeenCalled();
  expect(fakes.rpc).toHaveBeenCalledTimes(1);
  expect(fakes.signInWithOtp).toHaveBeenCalledOnce();
});

test('con sessione dell’email invitata riscatta per l’utente autenticato', async () => {
  fakes.rpc.mockResolvedValueOnce({ data: 'giusta@example.test', error: null })
    .mockResolvedValueOnce({ data: 'membro', error: null });
  fakes.getUser.mockResolvedValue({ data: { user: { id: 'verified-user', email: 'giusta@example.test' } }, error: null });
  const result = await acceptInviteAction(token, 'Nome');
  expect(result).toEqual({ ok: true, redirect: '/' });
  expect(fakes.rpc).toHaveBeenCalledWith('redeem_invite', expect.objectContaining({
    p_user: 'verified-user', p_email: 'giusta@example.test', p_display_name: 'Nome',
  }));
  expect(fakes.createUser).not.toHaveBeenCalled();
  expect(fakes.signInWithOtp).not.toHaveBeenCalled();
});

test('peek espone l’email fissata solo per un invito valido', async () => {
  const select = vi.fn();
  const query = { select, eq: vi.fn(), maybeSingle: vi.fn() };
  select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: { email: 'giusta@example.test', expires_at: '2099-01-01T00:00:00Z', used_at: null, revoked_at: null },
    error: null,
  });
  fakes.from.mockReturnValue(query);
  expect(await peekInviteAction(token)).toEqual({ ok: true, status: 'valido', email: 'giusta@example.test' });
  expect(fakes.from).toHaveBeenCalledWith('invites');
  expect(select).toHaveBeenCalledWith('email,expires_at,used_at,revoked_at');
});

test('peek distingue scaduto, usato, revocato e inesistente', async () => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  fakes.from.mockReturnValue(query);
  for (const [data, status] of [
    [{ email: 'giusta@example.test', expires_at: '2020-01-01T00:00:00Z', used_at: null, revoked_at: null }, 'scaduto'],
    [{ email: 'giusta@example.test', expires_at: '2099-01-01T00:00:00Z', used_at: '2026-01-01', revoked_at: null }, 'usato'],
    [{ email: 'giusta@example.test', expires_at: '2099-01-01T00:00:00Z', used_at: null, revoked_at: '2026-01-01' }, 'revocato'],
    [null, 'inesistente'],
  ] as const) {
    query.maybeSingle.mockResolvedValue({ data, error: null });
    const result = await peekInviteAction(token);
    expect(result).toMatchObject({ ok: false, status });
    if (!result.ok) expect(result.message).toContain('Chiedi a chi ti ha invitato un link nuovo');
  }
});

test('start usa l’email dell’invito e segnala un invio fallito senza dettagli', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.signInWithOtp.mockResolvedValue({ error: { message: 'internal: token secret' } });
  const result = await startInviteLoginAction(token, 'Nome');
  expect(result).toEqual({ ok: false, message: expect.stringContaining('Chiedi a chi ti ha invitato un link nuovo') });
  expect(fakes.signInWithOtp).toHaveBeenCalledWith({
    email: 'giusta@example.test',
    options: { shouldCreateUser: false },
  });
  expect(result.message).not.toContain('secret');
  expect(result.message).toContain('inviare il codice');
});

test.each([
  { code: 'over_email_send_rate_limit' },
  { status: 429 },
])('start segnala il limite di invio: %j', async (error) => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.signInWithOtp.mockResolvedValue({ error });
  expect(await startInviteLoginAction(token, 'Nome')).toEqual({
    ok: false, message: 'Aspetta un minuto prima di chiedere un altro codice.',
  });
});

test('start segnala anche il limite sollevato da Supabase', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.signInWithOtp.mockRejectedValue({ status: 429 });
  expect(await startInviteLoginAction(token, 'Nome')).toEqual({
    ok: false, message: 'Aspetta un minuto prima di chiedere un altro codice.',
  });
});

test('start con un altro account già autenticato non crea utenti e non invia link', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.getUser.mockResolvedValue({ data: { user: { id: 'other', email: 'altra@example.test' } }, error: null });
  const result = await startInviteLoginAction(token, 'Nome');
  expect(result).toMatchObject({ ok: false, message: expect.stringContaining('email') });
  expect(fakes.listUsers).not.toHaveBeenCalled();
  expect(fakes.createUser).not.toHaveBeenCalled();
  expect(fakes.signInWithOtp).not.toHaveBeenCalled();
});

test('verifica il codice e riscatta l’invito per l’utente restituito', async () => {
  fakes.rpc.mockResolvedValueOnce({ data: 'giusta@example.test', error: null })
    .mockResolvedValueOnce({ data: 'membro', error: null });
  fakes.verifyOtp.mockResolvedValue({ data: { user: { id: 'verified-user', email: 'giusta@example.test' } }, error: null });
  expect(await verifyInviteCodeAction(token, ' Nome ', '12345678')).toEqual({ ok: true, redirect: '/' });
  expect(fakes.verifyOtp).toHaveBeenCalledWith({ email: 'giusta@example.test', token: '12345678', type: 'email' });
  expect(fakes.rpc).toHaveBeenCalledWith('redeem_invite', {
    p_token_hash: expect.any(String), p_user: 'verified-user', p_email: 'giusta@example.test', p_display_name: 'Nome',
  });
});

test('verifica rifiuta token, nome e codice invalidi prima del DB', async () => {
  expect((await verifyInviteCodeAction('bad', 'Nome', '12345678')).ok).toBe(false);
  expect((await verifyInviteCodeAction(token, '', '12345678')).ok).toBe(false);
  expect((await verifyInviteCodeAction(token, 'Nome', '12a45678')).ok).toBe(false);
  expect((await verifyInviteCodeAction(token, 'Nome', '123456')).ok).toBe(false);
  expect((await verifyInviteCodeAction(token, 'Nome', '123456789')).ok).toBe(false);
  expect(fakes.rpc).not.toHaveBeenCalled();
  expect(fakes.verifyOtp).not.toHaveBeenCalled();
});

test('codice errato e troppi tentativi non riscattano l’invito', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.verifyOtp.mockResolvedValueOnce({ data: { user: null }, error: { status: 400 } })
    .mockResolvedValueOnce({ data: { user: null }, error: { status: 429 } });
  expect(await verifyInviteCodeAction(token, 'Nome', '12345678')).toEqual({
    ok: false, message: 'Codice sbagliato o scaduto. Controlla l’ultima mail o chiedine uno nuovo.',
  });
  expect(await verifyInviteCodeAction(token, 'Nome', '12345678')).toEqual({
    ok: false, message: 'Troppi tentativi. Aspetta un minuto e riprova.',
  });
  expect(fakes.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
});

test('verifica invito riconosce anche il 429 sollevato da Supabase', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.verifyOtp.mockRejectedValue({ status: 429 });
  expect(await verifyInviteCodeAction(token, 'Nome', '12345678')).toEqual({
    ok: false, message: 'Troppi tentativi. Aspetta un minuto e riprova.',
  });
  expect(fakes.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
});

test('email diversa dopo la verifica non riscatta l’invito', async () => {
  fakes.rpc.mockResolvedValue({ data: 'giusta@example.test', error: null });
  fakes.verifyOtp.mockResolvedValue({ data: { user: { id: 'other', email: 'altra@example.test' } }, error: null });
  expect(await verifyInviteCodeAction(token, 'Nome', '12345678')).toMatchObject({ ok: false, message: expect.stringContaining('email') });
  expect(fakes.rpc).not.toHaveBeenCalledWith('redeem_invite', expect.anything());
});

test('errore del database dopo la verifica conserva il messaggio pubblico', async () => {
  fakes.rpc.mockResolvedValueOnce({ data: 'giusta@example.test', error: null })
    .mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'invito_usato' } });
  fakes.verifyOtp.mockResolvedValue({ data: { user: { id: 'verified-user', email: 'giusta@example.test' } }, error: null });
  expect(await verifyInviteCodeAction(token, 'Nome', '12345678')).toEqual({
    ok: false, message: 'Questo invito è già stato usato. Chiedi a chi ti ha invitato un link nuovo.',
  });
});
