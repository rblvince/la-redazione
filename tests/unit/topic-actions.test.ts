import { beforeEach, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ rpc: vi.fn(), adminRpc: vi.fn(), getUser: vi.fn(), fetchPreview: vi.fn(), after: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ after: fakes.after }));
vi.mock('next/navigation', () => ({ redirect: fakes.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: fakes.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ rpc: fakes.rpc, auth: { getUser: fakes.getUser } }) }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: fakes.adminRpc }) }));
vi.mock('@/lib/preview', () => ({ fetchPreview: fakes.fetchPreview }));

import { commentAction, proposeAction, proposeFormAction } from '@/app/(app)/temi/actions';

test('proposeFormAction riusa la proposta e reindirizza dopo il successo', async () => {
  fakes.redirect.mockImplementationOnce(() => { throw new Error('NEXT_REDIRECT'); });
  await expect(proposeFormAction({ ok: false, message: '' }, form(''))).rejects.toThrow('NEXT_REDIRECT');
  expect(fakes.rpc).toHaveBeenCalledWith('propose_topic', expect.any(Object));
  expect(fakes.revalidatePath).toHaveBeenCalledWith('/temi');
  expect(fakes.redirect).toHaveBeenCalledExactlyOnceWith('/temi');
});

test('proposeFormAction restituisce l’errore senza reindirizzare', async () => {
  expect((await proposeFormAction({ ok: false, message: '' }, form('http://bad.it'))).ok).toBe(false);
  expect(fakes.redirect).not.toHaveBeenCalled();
});

function form(link: string) {
  const data = new FormData();
  data.set('title', 'Titolo');
  data.set('link', link);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  fakes.getUser.mockResolvedValue({ data: { user: { id: 'actor-id' } }, error: null });
  fakes.fetchPreview.mockResolvedValue({ title: 'Anteprima', site: 'falso.it' });
  fakes.rpc.mockResolvedValue({ data: 'topic-id', error: null });
  fakes.adminRpc.mockResolvedValue({ data: null, error: null });
});

test('claim_preview rifiutata lascia il tema salvato e ferma la rete', async () => {
  fakes.rpc.mockResolvedValueOnce({ data: 'topic-id', error: null });
  fakes.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'troppe_richieste' } });
  expect(await proposeAction(form('https://a.it/x'))).toEqual({ ok: true, id: 'topic-id' });
  expect(fakes.rpc).toHaveBeenCalledExactlyOnceWith('propose_topic', {
    p_title: 'Titolo', p_body: null, p_link: 'https://a.it/x', p_link_title: null, p_format: null,
  });
  await fakes.after.mock.calls[0][0]();
  expect(fakes.rpc.mock.calls[1]).toEqual(['claim_preview']);
  expect(fakes.fetchPreview).not.toHaveBeenCalled();
  expect(fakes.adminRpc).not.toHaveBeenCalled();
});

test('salva il link canonico prima di iniziare anteprima e aggiornamento', async () => {
  expect(await proposeAction(form('HTTPS://A.it/x'))).toEqual({ ok: true, id: 'topic-id' });
  expect(fakes.rpc.mock.calls[0]).toEqual(['propose_topic', {
    p_title: 'Titolo', p_body: null, p_link: 'https://a.it/x',
    p_link_title: null, p_format: null,
  }]);
  expect(fakes.fetchPreview).not.toHaveBeenCalled();
  await fakes.after.mock.calls[0][0]();
  expect(fakes.rpc.mock.calls[1]).toEqual(['claim_preview']);
  expect(fakes.fetchPreview).toHaveBeenCalledExactlyOnceWith(new URL('https://a.it/x'));
  expect(fakes.adminRpc).toHaveBeenCalledExactlyOnceWith('set_link_title', {
    p_topic: 'topic-id', p_actor: 'actor-id', p_title: 'Anteprima',
  });
  expect(fakes.getUser).toHaveBeenCalledOnce();
  expect(fakes.rpc).toHaveBeenCalledTimes(2);
});

test('senza utente verificato non avvia il flusso privilegiato', async () => {
  fakes.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'sessione scaduta' } });
  expect((await proposeAction(form('https://a.it/x'))).ok).toBe(false);
  expect(fakes.rpc).not.toHaveBeenCalled();
  expect(fakes.after).not.toHaveBeenCalled();
  expect(fakes.adminRpc).not.toHaveBeenCalled();
});

test('anteprima fallita lascia il tema salvato senza errore', async () => {
  fakes.fetchPreview.mockRejectedValueOnce(new Error('rete'));
  expect(await proposeAction(form('https://a.it/x'))).toEqual({ ok: true, id: 'topic-id' });
  await expect(fakes.after.mock.calls[0][0]()).resolves.toBeUndefined();
  expect(fakes.rpc).toHaveBeenCalledTimes(2);
});

test('link canonici invalidi non consumano claim_preview', async () => {
  for (const link of ['https://foo_bar.example/x', `https://a.it/${'é'.repeat(700)}`]) {
    expect(await proposeAction(form(link))).toEqual({ ok: false, message: 'Controlla i dati inseriti e riprova.' });
  }
  expect(fakes.rpc).not.toHaveBeenCalled();
  expect(fakes.fetchPreview).not.toHaveBeenCalled();
});

test('titoli e commenti con controlli bidi sono respinti', async () => {
  const data = form('');
  data.set('title', 'Titolo\u202ealterato');
  expect((await proposeAction(data)).ok).toBe(false);
  expect((await commentAction('00000000-0000-0000-0000-000000000001', 'Testo\u202ealterato')).ok).toBe(false);
  expect(fakes.rpc).not.toHaveBeenCalled();
});

test('gli spazi invisibili da soli sono respinti', async () => {
  for (const blank of ['\u202f', '\u200b', '\ufeff', '\u00ad\u200e', '\u034f\u115f\uffa0\u{e0020}', '\u0301']) {
    const data = form('');
    data.set('title', blank);
    expect((await proposeAction(data)).ok).toBe(false);
    expect((await commentAction('11111111-1111-4111-8111-111111111111', blank)).ok).toBe(false);
  }
  expect(fakes.rpc).not.toHaveBeenCalled();
});

test.each(['è', '🔥', '1'])('accetta il carattere visibile %s in titolo e commento', async (value) => {
  const data = form('');
  data.set('title', value);
  expect(await proposeAction(data)).toEqual({ ok: true, id: 'topic-id' });
  expect(await commentAction('11111111-1111-4111-8111-111111111111', value))
    .toEqual({ ok: true, id: 'topic-id' });
});

test('titoli e commenti oltre il limite grezzo sono respinti prima della pulizia', async () => {
  const data = form('');
  data.set('title', `Titolo${' '.repeat(1995)}`);
  expect((await proposeAction(data)).ok).toBe(false);
  expect((await commentAction('00000000-0000-0000-0000-000000000001', `Testo${' '.repeat(7996)}`)).ok).toBe(false);
  expect(fakes.rpc).not.toHaveBeenCalled();
});
