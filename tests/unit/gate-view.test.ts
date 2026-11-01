import { expect, test } from 'vitest';
import { gateLines } from '@/lib/domain/gate-view';

test('traduce le chiavi del cancello con le etichette del piano', () => {
  expect(gateLines({ ok: false, missing: ['copyright', 'rilettura'] })).toEqual([
    'Copyright: immagini/video sono nostri, con licenza, o citati nei limiti del diritto di critica?',
    'Manca il sì di chi rilegge',
  ]);
  expect(gateLines({ ok: true, missing: [] })).toEqual([]);
});

test('ignora chiavi sconosciute e non mostra mancanze se il cancello è aperto', () => {
  expect(gateLines({ ok: false, missing: ['ignota', 'scrittore', 'rilettore'] }))
    .toEqual(['Manca chi scrive', 'Manca chi rilegge']);
  expect(gateLines({ ok: true, missing: ['copyright'] })).toEqual([]);
});

test('mostra la fonte mancante', () => {
  expect(gateLines({ ok: false, missing: ['fonti'] })).toEqual(['Manca almeno una fonte']);
});
