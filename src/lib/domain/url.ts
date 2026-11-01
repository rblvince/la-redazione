function ipVersion(input: string): 0 | 4 | 6 {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(input)
    && input.split('.').every((part) => Number(part) <= 255)) return 4;
  if (!input.includes(':')) return 0;
  try {
    return new URL(`http://[${input}]/`).hostname.startsWith('[') ? 6 : 0;
  } catch {
    return 0;
  }
}

export function isAllowedLinkHost(hostname: string): boolean {
  if (!/^[a-z0-9.-]+$/.test(hostname)) return false;
  const host = hostname.replace(/\.+$/, '');
  return host.includes('.') && host !== 'localhost'
    && !/\.(?:local|internal|localhost)$/.test(host) && ipVersion(host) !== 4;
}

export function isAllowedCanonicalLink(url: URL): boolean {
  return url.toString().length <= 2048 && isAllowedLinkHost(url.hostname);
}

export function parseHttpsUrl(input: string): URL | null {
  if (typeof input !== 'string' || input.length > 2048 || /\s/.test(input)) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !url.hostname || url.hostname.startsWith('[')
      || url.username || url.password || url.port || !isAllowedCanonicalLink(url)) return null;
    return url;
  } catch {
    return null;
  }
}

export function safeHref(url: string | null): string | null {
  return url === null ? null : parseHttpsUrl(url)?.toString() ?? null;
}

function publicV4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && c === 0))) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6Words(input: string): number[] | null {
  let ip = input.toLowerCase();
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    const v4 = ip.slice(lastColon + 1);
    if (ipVersion(v4) !== 4) return null;
    const bytes = v4.split('.').map(Number);
    ip = `${ip.slice(0, lastColon + 1)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const parts = ip.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':').map((v) => parseInt(v, 16)) : [];
  const tail = parts[1] ? parts[1].split(':').map((v) => parseInt(v, 16)) : [];
  const zeros = 8 - head.length - tail.length;
  if (zeros < 0 || (parts.length === 1 && zeros !== 0)) return null;
  return [...head, ...Array(zeros).fill(0), ...tail];
}

export function isPublicAddress(ip: string): boolean {
  const version = ipVersion(ip);
  if (version === 4) return publicV4(ip);
  if (version !== 6) return false;
  const words = ipv6Words(ip);
  if (!words) return false;
  const [first, second] = words;
  if ((first & 0xe000) !== 0x2000) return false; // Only 2000::/3 is globally routable.
  if (words.slice(0, 6).every((v) => v === 0)) return false; // ::/96, including :: and ::1
  if (first === 0x64 && second === 0xff9b && words.slice(2, 6).every((v) => v === 0)) return false;
  if (first === 0x64 && second === 0xff9b && words[2] === 1) return false;
  if (first === 0x2002 || (first === 0x2001 && (second === 0 || second === 0xdb8))) return false;
  if (first === 0x100 && words.slice(1, 4).every((v) => v === 0)) return false;
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return false;
  if (words.slice(0, 5).every((v) => v === 0) && second === 0 && words[5] === 0xffff) {
    const mapped = `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
    return publicV4(mapped);
  }
  return true;
}
