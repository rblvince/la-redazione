import { expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabaseClient: () => ({
  storage: { from: fakes.from },
}) }));
import { removeSourceScreenshot, runWithScreenshotCleanup, uploadSourceScreenshot, validateSourceScreenshot } from '@/lib/upload/source-screenshot';

const topic = '11111111-1111-4111-8111-111111111111';

test.each([
  ['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp'],
])('accetta %s entro 5 MB', (type, extension) => {
  expect(validateSourceScreenshot(topic, { type, size: 5 * 1024 * 1024 }))
    .toEqual({ ok: true, extension });
});

test('rifiuta id, MIME, file vuoti e file grandi prima dell’upload', () => {
  for (const [id, file] of [
    ['bad', { type: 'image/png', size: 5 }],
    [topic, { type: 'image/svg+xml', size: 5 }],
    [topic, { type: 'image/png', size: 0 }],
    [topic, { type: 'image/png', size: 5 * 1024 * 1024 + 1 }],
  ] as const) expect(validateSourceScreenshot(id, file).ok).toBe(false);
});

test('carica nel bucket privato con percorso ammesso dalla action', async () => {
  fakes.from.mockReturnValue({ upload: fakes.upload });
  fakes.upload.mockResolvedValue({ data: {}, error: null });
  const file = new File(['png'], 'nome-arbitrario.txt', { type: 'image/png' });
  const result = await uploadSourceScreenshot(topic, file);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.path).toMatch(new RegExp(`^${topic}/[0-9a-f-]{36}\\.png$`));
  expect(fakes.from).toHaveBeenCalledWith('fonti');
  expect(fakes.upload).toHaveBeenCalledExactlyOnceWith(result.path, file, {
    contentType: 'image/png', upsert: false,
  });
});

test('non apre il client per file invalidi', async () => {
  fakes.from.mockClear();
  expect((await uploadSourceScreenshot(topic, new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).ok)
    .toBe(false);
  expect(fakes.from).not.toHaveBeenCalled();
});

test('rimuove dal bucket il percorso caricato', async () => {
  fakes.from.mockReturnValue({ remove: fakes.remove });
  fakes.remove.mockResolvedValue({ data: [], error: null });
  const path = `${topic}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
  await removeSourceScreenshot(path);
  expect(fakes.from).toHaveBeenCalledWith('fonti');
  expect(fakes.remove).toHaveBeenCalledExactlyOnceWith([path]);
});

test('se il salvataggio fallisce rimuove lo screenshot e conserva il risultato originale', async () => {
  const path = `${topic}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
  fakes.from.mockReturnValue({ remove: fakes.remove });
  fakes.remove.mockResolvedValue({ data: null, error: { message: 'rimozione negata' } });
  const result = { ok: false as const, message: 'Fonte non salvata' };
  expect(await runWithScreenshotCleanup(path, async () => result)).toEqual(result);
  expect(fakes.remove).toHaveBeenCalledExactlyOnceWith([path]);
});

test('se il salvataggio genera un errore tenta la pulizia e propaga l’errore', async () => {
  const path = `${topic}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp`;
  const failure = new Error('rete');
  fakes.from.mockReturnValue({ remove: fakes.remove });
  fakes.remove.mockRejectedValue(new Error('storage'));
  await expect(runWithScreenshotCleanup(path, async () => { throw failure; })).rejects.toBe(failure);
  expect(fakes.remove).toHaveBeenCalledExactlyOnceWith([path]);
});

test('se il salvataggio riesce o non c’è screenshot non elimina oggetti', async () => {
  fakes.remove.mockClear();
  expect(await runWithScreenshotCleanup(null, async () => ({ ok: false as const }))).toEqual({ ok: false });
  expect(await runWithScreenshotCleanup('percorso', async () => ({ ok: true as const }))).toEqual({ ok: true });
  expect(fakes.remove).not.toHaveBeenCalled();
});
