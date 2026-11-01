import 'server-only';

import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { cleanText, hasBidiControls, hasVisibleChar } from '@/lib/domain/text';
import { isPublicAddress, parseHttpsUrl } from '@/lib/domain/url';

type Preview = { title: string | null; site: string | null };
type Requester = (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;
type Dependencies = {
  lookup?: (hostname: string) => Promise<string[]>;
  request?: Requester;
};
const EMPTY: Preview = { title: null, site: null };
const MAX_BYTES = 512 * 1024;
const MAX_HTML_CHARS = 64 * 1024;
const MAX_META_TAG_CHARS = 2 * 1024;

async function defaultLookup(hostname: string): Promise<string[]> {
  return (await dnsLookup(hostname, { all: true })).map((entry) => entry.address);
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#\d+|#x[\da-f]+);/gi, (entity) => {
    const name = entity.slice(1, -1).toLowerCase();
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
    if (name in named) return named[name];
    const code = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : '';
  });
}

function clean(text: string): string {
  const source = text.slice(0, 2000);
  const lower = source.toLowerCase();
  let output = '';
  for (let i = 0; i < source.length;) {
    if (source[i] !== '<') {
      output += source[i++];
      continue;
    }
    const end = source.indexOf('>', i + 1);
    if (end < 0) break;
    if (lower.startsWith('<script', i) && /[\s/>]/.test(source[i + 7] ?? '')) {
      const close = lower.indexOf('</script', end + 1);
      if (close < 0) break;
      const closeEnd = source.indexOf('>', close + 8);
      if (closeEnd < 0) break;
      i = closeEnd + 1;
    } else {
      i = end + 1;
    }
  }
  return decodeEntities(output).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 200);
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  let i = 5; // Skip <meta.
  while (i < tag.length) {
    while (i < tag.length && /[\s/]/.test(tag[i])) i++;
    if (tag[i] === '>' || i >= tag.length) break;
    const nameStart = i;
    while (i < tag.length && !/[\s=/>]/.test(tag[i])) i++;
    if (i === nameStart) { i++; continue; }
    const name = tag.slice(nameStart, i).toLowerCase();
    while (i < tag.length && /\s/.test(tag[i])) i++;
    if (tag[i] !== '=') continue;
    i++;
    while (i < tag.length && /\s/.test(tag[i])) i++;
    const quote = tag[i];
    if (quote !== '"' && quote !== "'") continue;
    const start = ++i;
    while (i < tag.length && tag[i] !== quote) i++;
    if (i >= tag.length) break;
    result.set(name, tag.slice(start, i));
    i++;
  }
  return result;
}

function metaContent(html: string, property: string): string | null {
  const lower = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = lower.indexOf('<meta', cursor);
    if (start < 0) break;
    if (!/[\s/>]/.test(html[start + 5] ?? '')) { cursor = start + 5; continue; }
    let end = start + 5;
    let quote = '';
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end >= html.length) break;
    if (end - start <= MAX_META_TAG_CHARS) {
      const attrs = attributes(html.slice(start, end + 1));
      if (attrs.get('property')?.toLowerCase() === property) return attrs.get('content') ?? null;
    }
    cursor = end + 1;
  }
  return null;
}

function titleContent(html: string): string | null {
  const lower = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = lower.indexOf('<title', cursor);
    if (start < 0) return null;
    if (!/[\s/>]/.test(html[start + 6] ?? '')) { cursor = start + 6; continue; }
    const openEnd = html.indexOf('>', start + 6);
    if (openEnd < 0) return null;
    const close = lower.indexOf('</title', openEnd + 1);
    if (close < 0) return null;
    if (!/[\s>]/.test(html[close + 7] ?? '')) { cursor = close + 7; continue; }
    const closeEnd = html.indexOf('>', close + 7);
    if (closeEnd < 0) return null;
    return html.slice(openEnd + 1, close);
  }
  return null;
}

function parseHtml(html: string, hostname: string): Preview {
  const site = hostname.replace(/^www\./i, '');
  const head = html.slice(0, MAX_HTML_CHARS);
  const end = head.toLowerCase().indexOf('</head>');
  const bounded = end < 0 ? head : head.slice(0, end);
  const extracted = cleanText(clean(metaContent(bounded, 'og:title') ?? ''))
    || cleanText(clean(titleContent(bounded) ?? ''));
  return { title: extracted && !hasBidiControls(extracted) && hasVisibleChar(extracted) ? extracted : site, site };
}

function decodeHtml(bytes: Buffer, contentType: string): string {
  const header = /charset\s*=\s*["']?([a-z0-9-]+)/i.exec(contentType)?.[1];
  const beginning = bytes.subarray(0, 1024).toString('latin1');
  const meta = /<meta\b[^>]*\bcharset\s*=\s*["']?([a-z0-9-]+)/i.exec(beginning)?.[1];
  const declared = (header ?? meta ?? 'utf-8').toLowerCase();
  const encoding = ['utf-8', 'iso-8859-1', 'windows-1252', 'iso-8859-15'].includes(declared)
    ? declared : 'utf-8';
  return new TextDecoder(encoding).decode(bytes);
}

type Response = { status: number; location: string | null; html: string | null };

function readResponse(
  url: URL, address: string, request: Requester, signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const options: RequestOptions = {
      protocol: 'https:', hostname, port: 443, path: `${url.pathname}${url.search}`,
      method: 'GET', signal, family: isIP(address),
      lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
      headers: { 'User-Agent': 'RedazioneBot/1.0', Accept: 'text/html' },
    };
    const req = request(options, (res: IncomingMessage) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === 'string' ? res.headers.location : null;
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.destroy();
        req.destroy();
        resolve({ status, location, html: null });
        return;
      }
      const contentType = res.headers['content-type'];
      if (status !== 200 || typeof contentType !== 'string' || !/^text\/html(?:\s*;|\s*$)/i.test(contentType)) {
        res.destroy();
        resolve({ status, location: null, html: null });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BYTES) {
          req.destroy();
          res.destroy();
          reject(new Error('too_large'));
        } else chunks.push(buffer);
      });
      res.on('end', () => resolve({ status, location: null, html: decodeHtml(Buffer.concat(chunks), contentType) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

export async function fetchPreview(url: URL, deps: Dependencies = {}): Promise<Preview> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  });
  try {
    let current = parseHttpsUrl(url.toString());
    if (!current) return EMPTY;
    const lookup = deps.lookup ?? defaultLookup;
    const request = deps.request ?? httpsRequest;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const hostname = current.hostname.replace(/^\[|\]$/g, '');
      const addresses = await Promise.race([lookup(hostname), aborted]);
      if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) return EMPTY;
      const response = await Promise.race([readResponse(current, addresses[0], request, controller.signal), aborted]);
      if (response.location !== null && [301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === 3) return EMPTY;
        current = parseHttpsUrl(new URL(response.location, current).toString());
        if (!current) return EMPTY;
        continue;
      }
      return response.html === null ? EMPTY : parseHtml(response.html, current.hostname);
    }
    return EMPTY;
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
