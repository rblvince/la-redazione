import { expect, test } from 'vitest';
import { errorMessage } from '@/lib/domain/errors';

test('ogni codice noto ha un messaggio italiano specifico', () => {
  for (const code of ['non_autorizzato', 'troppe_richieste', 'invito_non_valido', 'invito_scaduto', 'invito_usato', 'email_diversa', 'fase_sbagliata', 'stesse_persone', 'cancello_chiuso', 'dati_non_validi']) {
    const message = errorMessage(code);
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe('Qualcosa non ha funzionato. Riprova.');
  }
  expect(errorMessage('troppe_richieste')).toBe('Hai fatto troppe richieste. Riprova tra qualche minuto.');
  for (const code of ['invito_non_valido', 'invito_scaduto', 'invito_usato', 'invio_fallito']) {
    expect(errorMessage(code)).toContain('Chiedi a chi ti ha invitato un link nuovo');
  }
});

test('codici ignoti e dettagli interni diventano generici', () => {
  for (const code of ['sconosciuto', 'connection refused at 10.0.0.1', 'invito_usato: hash=abc']) {
    expect(errorMessage(code)).toBe('Qualcosa non ha funzionato. Riprova.');
  }
});
