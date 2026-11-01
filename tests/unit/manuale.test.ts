import { expect, test } from 'vitest';
import { manuale } from '@/content/manuale';
import type { Block } from '@/content/manuale';

function texts(block: Block): string[] {
  switch (block.kind) {
    case 'p': return [block.text];
    case 'h': return [block.text, block.tag ?? ''];
    case 'list': return block.items;
    case 'link': return [block.label, block.href];
  }
}

test('il Manuale ha le cinque sezioni del manuale, in ordine', () => {
  expect(manuale.map((s) => s.id)).toEqual(['manifesto', 'tono', 'verifica', 'legislazione', 'glossario']);
});

test('la verifica contiene i 5 passaggi nell\'ordine del manuale', () => {
  const verifica = manuale.find((s) => s.id === 'verifica');
  expect(verifica).toBeDefined();
  const titles = verifica!.blocks.flatMap((b) => (b.kind === 'h' ? [b.text] : []));
  const steps = [
    'Isolare l\'affermazione centrale',
    'Trovare la fonte primaria, non un rilancio',
    'Leggere la fonte per intero',
    'Cercare un secondo riscontro se la notizia è delicata',
    'Fare il controllo legale prima di scrivere il giudizio',
  ];
  let from = 0;
  for (const step of steps) {
    const at = titles.findIndex((t, i) => i >= from && t.endsWith(step));
    expect(at, step).toBeGreaterThanOrEqual(from);
    from = at + 1;
  }
});

test('ogni link del Manuale parte da https://', () => {
  const hrefs = manuale.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'link' ? [b.href] : [])));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href.startsWith('https://'), href).toBe(true);
});

test('nessun testo del Manuale contiene "<" (si rende solo come testo)', () => {
  for (const section of manuale) {
    expect(section.title).not.toContain('<');
    for (const block of section.blocks) for (const t of texts(block)) expect(t).not.toContain('<');
  }
});

test('nessuna emoji usata come icona nel Manuale', () => {
  const icons = /[✅❌⚠]/u;
  for (const section of manuale) {
    for (const block of section.blocks) for (const t of texts(block)) expect(t).not.toMatch(icons);
  }
});
