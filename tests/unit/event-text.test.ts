import { expect, test } from 'vitest';
import { describeEvent } from '@/lib/domain/event-text';

const people = {
  marco: { display_name: 'Marco' },
  giulia: { display_name: 'Giulia' },
};

test.each([
  ['proposto', {}, 'Marco ha proposto il tema'],
  ['commento', {}, 'Marco ha commentato'],
  ['votato', { value: true }, 'Marco ha votato sì'],
  ['votato', { value: false }, 'Marco ha votato no'],
  ['deciso', {}, 'Marco ha approvato il tema'],
  ['parcheggiato', {}, 'Marco ha parcheggiato il tema'],
  ['riattivato', { round: 2 }, 'Marco ha riattivato il tema'],
  ['persone_assegnate', { writer_id: 'marco', reviewer_id: 'giulia' }, 'Marco ha assegnato Marco alla scrittura e Giulia alla rilettura'],
  ['spunta', { item: 'lettura_intera', kind: 'verifica' }, 'Marco ha spuntato «Leggere la fonte per intero»'],
  ['spunta_tolta', { item: 'copyright', kind: 'legale' }, 'Marco ha tolto la spunta a «Copyright: immagini/video sono nostri, con licenza, o citati nei limiti del diritto di critica?»'],
  ['fonte_aggiunta', {}, 'Marco ha aggiunto una fonte'],
  ['fonte_eliminata', {}, 'Marco ha eliminato una fonte'],
  ['rilettura_approvata', {}, 'Marco ha approvato la rilettura'],
  ['pubblicato', {}, 'Marco ha segnato il tema come pubblicato'],
  ['rettifica', {}, 'Marco ha aggiunto una rettifica'],
] as const)('descrive %s', (kind, data, expected) => {
  expect(describeEvent({ kind, actor_id: 'marco', data }, people)).toBe(expected);
});

test('oscura il manutentore, usa Qualcuno per ID ignoti e non riflette chiavi sconosciute', () => {
  expect(describeEvent({ kind: 'deciso', actor_id: null, data: {} }, people))
    .toBe('Il tema è stato approvato');
  expect(describeEvent({ kind: 'proposto', actor_id: null, data: {} }, people))
    .toBe('Manutenzione ha proposto il tema');
  expect(describeEvent({ kind: 'commento', actor_id: 'ignoto', data: {} }, people))
    .toBe('Qualcuno ha commentato');
  expect(describeEvent({ kind: 'spunta', actor_id: 'marco', data: { item: '<script>' } }, people))
    .toBe('Marco ha aggiornato una spunta');
});
