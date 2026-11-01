const messages: Record<string, string> = {
  non_autorizzato: 'Non hai il permesso per questa operazione.',
  troppe_richieste: 'Hai fatto troppe richieste. Riprova tra qualche minuto.',
  invito_non_valido: 'Questo invito non è valido o è stato revocato. Chiedi a chi ti ha invitato un link nuovo.',
  invito_scaduto: 'Questo invito è scaduto. Chiedi a chi ti ha invitato un link nuovo.',
  invito_usato: 'Questo invito è già stato usato. Chiedi a chi ti ha invitato un link nuovo.',
  invio_fallito: 'Non siamo riusciti a inviare il codice. Chiedi a chi ti ha invitato un link nuovo.',
  email_diversa: 'Questo invito è legato a un’altra email. Esci e apri il link con quella corretta.',
  fase_sbagliata: 'Il tema non è nella fase richiesta.',
  stesse_persone: 'Chi scrive e chi rilegge devono essere persone diverse.',
  cancello_chiuso: 'Completa le verifiche e la rilettura prima di pubblicare.',
  dati_non_validi: 'Controlla i dati inseriti e riprova.',
};

export const GENERIC_ERROR = 'Qualcosa non ha funzionato. Riprova.';

export function errorMessage(code: string): string {
  return Object.hasOwn(messages, code) ? messages[code] : GENERIC_ERROR;
}

export function databaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error
    && error.code === 'P0001' && typeof error.message === 'string') {
    return errorMessage(error.message);
  }
  return GENERIC_ERROR;
}
