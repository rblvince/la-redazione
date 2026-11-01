import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import type { ClientRequest } from 'node:http';
import { PassThrough } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { fetchPreview } from '@/lib/preview';

function fakeRequest(responses: Array<{ status?: number; location?: string; type?: string; body?: string | Buffer }>) {
  let calls = 0;
  let destroyed = 0;
  const request = vi.fn(((options: RequestOptions, callback: (res: IncomingMessage) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
    req.destroy = () => { destroyed++; };
    options.signal?.addEventListener('abort', () => req.destroy(), { once: true });
    req.end = () => {
      const item = responses[calls++];
      if (!item) return;
      const res = new PassThrough() as PassThrough & IncomingMessage;
      res.statusCode = item.status ?? 200;
      res.headers = { 'content-type': item.type ?? 'text/html', ...(item.location ? { location: item.location } : {}) };
      queueMicrotask(() => {
        callback(res);
        res.end(item.body ?? '');
      });
    };
    void options;
    return req as unknown as ClientRequest;
  }));
  return { request, calls: () => calls, destroyed: () => destroyed };
}

const publicLookup = async () => ['151.101.1.1'];

describe('anteprima isolata', () => {
  test('rifiuta tutti gli indirizzi se anche uno è privato, senza richiesta', async () => {
    const fake = fakeRequest([]);
    expect(await fetchPreview(new URL('https://a.it'), {
      lookup: async () => ['151.101.1.1', '10.0.0.1'], request: fake.request,
    })).toEqual({ title: null, site: null });
    expect(fake.request).not.toHaveBeenCalled();
  });

  test('ricontrolla il DNS sul redirect e blocca il quarto redirect', async () => {
    const privateRedirect = fakeRequest([{ status: 302, location: 'https://interno.it' }]);
    expect(await fetchPreview(new URL('https://a.it'), {
      lookup: async (host) => host === 'interno.it' ? ['10.0.0.1'] : ['151.101.1.1'],
      request: privateRedirect.request,
    })).toEqual({ title: null, site: null });
    expect(privateRedirect.request).toHaveBeenCalledTimes(1);
    expect(privateRedirect.destroyed()).toBeGreaterThan(0);

    const many = fakeRequest(Array.from({ length: 4 }, () => ({ status: 302, location: 'https://a.it/next' })));
    expect(await fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request: many.request }))
      .toEqual({ title: null, site: null });
    expect(many.request).toHaveBeenCalledTimes(4);
    expect(many.destroyed()).toBeGreaterThan(0);
  });

  test('rifiuta HTTP, PDF e supera mai il limite di lettura', async () => {
    for (const item of [{ status: 302, location: 'http://10.0.0.1' }, { type: 'application/pdf' }]) {
      const fake = fakeRequest([item]);
      expect(await fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request: fake.request }))
        .toEqual({ title: null, site: null });
    }
    const huge = fakeRequest([{ body: Buffer.alloc(600 * 1024, 65) }]);
    expect(await fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request: huge.request }))
      .toEqual({ title: null, site: null });
    expect(huge.destroyed()).toBeGreaterThan(0);
  });

  test('timeout totale restituisce null', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn(((options: RequestOptions) => {
        const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
        req.end = () => {};
        req.destroy = vi.fn();
        options.signal?.addEventListener('abort', () => req.destroy(), { once: true });
        return req as unknown as ClientRequest;
      }));
      const result = fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request });
      await vi.advanceTimersByTimeAsync(3001);
      expect(await result).toEqual({ title: null, site: null });
      expect(request.mock.results[0].value.destroy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('estrae metadati in testo semplice, anche con attributi invertiti', async () => {
    const fake = fakeRequest([{ body: `<title>Fallback</title><meta content='Dato &amp; <script>brutto</script> buono' property='og:title'><meta content="Sito &#39;vero&#39;" property="og:site_name">` }]);
    expect(await fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request: fake.request }))
      .toEqual({ title: 'Dato & buono', site: 'a.it' });
  });

  test.each([
    ['meta molto lungo', `<meta ${'a'.repeat(500_000)}>`],
    ['title ripetuto', '<title '.repeat(70_000)],
    ['script ripetuto nel titolo', `<title>${'<script>'.repeat(60_000)}</title>`],
    ['aperture di tag nel titolo', `<title>${'<'.repeat(500_000)}</title>`],
  ])('elabora %s entro 200 ms', async (_case, body) => {
    const fake = fakeRequest([{ body }]);
    const started = performance.now();
    const result = await fetchPreview(new URL('https://a.it'), { lookup: publicLookup, request: fake.request });
    expect(performance.now() - started).toBeLessThan(200);
    expect(result).toEqual({ title: 'a.it', site: 'a.it' });
  });

  test('sceglie il primo titolo pulito non vuoto', async () => {
    const fake = fakeRequest([{ body: '<meta property="og:title" content="  "><title>Notizia</title>' }]);
    expect(await fetchPreview(new URL('https://www.a.it'), { lookup: publicLookup, request: fake.request }))
      .toEqual({ title: 'Notizia', site: 'a.it' });
  });

  test.each([
    '<title>Notizia\u202e alterata</title>',
    '<meta property="og:title" content="Notizia\u202e alterata"><title>Fallback</title>',
  ])('scarta il titolo bidi e usa il sito', async (body) => {
    const fake = fakeRequest([{ body }]);
    expect(await fetchPreview(new URL('https://www.a.it'), { lookup: publicLookup, request: fake.request }))
      .toEqual({ title: 'a.it', site: 'a.it' });
  });

  test('pulisce gli spazi invisibili ai bordi del titolo', async () => {
    const fake = fakeRequest([{ body: '<title>\u200b Notizia \u2060</title>' }]);
    expect(await fetchPreview(new URL('https://www.a.it'), { lookup: publicLookup, request: fake.request }))
      .toEqual({ title: 'Notizia', site: 'a.it' });
  });

  test('usa il sito quando il titolo contiene solo caratteri invisibili', async () => {
    const fake = fakeRequest([{ body: '<title>\u00ad\u200e</title>' }]);
    expect(await fetchPreview(new URL('https://www.a.it'), { lookup: publicLookup, request: fake.request }))
      .toEqual({ title: 'a.it', site: 'a.it' });
  });

  test('decodifica il charset dichiarato negli header o nel meta iniziale', async () => {
    const body = Buffer.from('<title>Perch\xe9</title>', 'latin1');
    for (const item of [
      { type: 'text/html; charset=iso-8859-1', body },
      { type: 'text/html', body: Buffer.concat([Buffer.from('<meta charset="iso-8859-1">'), body]) },
    ]) {
      const fake = fakeRequest([item]);
      expect(await fetchPreview(new URL('https://www.a.it'), { lookup: publicLookup, request: fake.request }))
        .toEqual({ title: 'Perché', site: 'a.it' });
    }
  });

  test('la connessione riceve solo l’IP verificato e nessuna credenziale', async () => {
    const fake = fakeRequest([{ body: '<title>Titolo</title>' }]);
    await fetchPreview(new URL('https://a.it/pagina'), { lookup: publicLookup, request: fake.request });
    const options = fake.request.mock.calls[0][0];
    expect(options.headers).toEqual({ 'User-Agent': 'RedazioneBot/1.0', Accept: 'text/html' });
    expect(options.hostname).toBe('a.it');
    expect(options.path).toBe('/pagina');
    const connected = await new Promise<string>((resolve, reject) => {
      options.lookup?.('a.it', {}, (error, address) => error ? reject(error) : resolve(address as string));
    });
    expect(connected).toBe('151.101.1.1');
  });
});
