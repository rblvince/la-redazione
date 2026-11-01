import { describe, expect, test } from 'vitest';
import { isPublicAddress, parseHttpsUrl, safeHref } from '@/lib/domain/url';

test('safeHref restituisce solo link HTTPS validi', () => {
  expect(safeHref('https://ansa.it/articolo')).toBe('https://ansa.it/articolo');
  expect(safeHref('http://ansa.it')).toBeNull();
  expect(safeHref('https://localhost/x')).toBeNull();
  expect(safeHref(null)).toBeNull();
});

describe('URL per i link degli utenti', () => {
  test('accetta solo HTTPS senza credenziali, porta diversa o URL troppo lungo', () => {
    expect(parseHttpsUrl('https://ansa.it/x')?.hostname).toBe('ansa.it');
    expect(parseHttpsUrl('https://a.it:443/x')?.pathname).toBe('/x');
    expect(parseHttpsUrl('https://[2a00:1450:4001::1]/x')).toBeNull();
    for (const value of ['http://a.it', 'https://u:p@a.it', 'javascript:alert(1)',
      'https://a.it:8443/x', `https://a.it/${'x'.repeat(2040)}`]) {
      expect(parseHttpsUrl(value)).toBeNull();
    }
    for (const value of ['https://foo_bar.example/x', `https://a.it/${'é'.repeat(700)}`,
      'https://localhost/x', 'https://printer/x', 'https://host.local/x',
      'https://host.internal/x', 'https://host.localhost/x', 'https://192.0.2.1/x']) {
      expect(parseHttpsUrl(value), value.slice(0, 50)).toBeNull();
    }
  });

  test('rifiuta indirizzi interni e non validi', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '::1', 'fd00::1',
      '::ffff:127.0.0.1', '100.64.0.1', '0.0.0.0', '192.0.0.1', '198.18.0.1',
      '224.0.0.1', 'ff02::1', '::', 'nonunip', 'fec0::1',
      '192.0.2.1', '198.51.100.1', '203.0.113.1', '192.88.99.1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress('151.101.1.1')).toBe(true);
    expect(isPublicAddress('2a00:1450::1')).toBe(true);
    for (const ip of ['::127.0.0.1', '64:ff9b::a9fe:a9fe', '64:ff9b:1::1',
      '2002:7f00:1::', '2001:0:4136::1', '2001:db8::1', '100::1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress('2a00:1450:4001::1')).toBe(true);
  });
});
