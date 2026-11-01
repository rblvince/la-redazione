export const CHECK_LABELS: Readonly<Record<string, string>> = {
  isolare: 'Isolare l\'affermazione centrale',
  fonte_primaria: 'Trovare la fonte primaria, non un rilancio',
  lettura_intera: 'Leggere la fonte per intero',
  secondo_riscontro: 'Cercare un secondo riscontro se la notizia è delicata',
  controllo_legale: 'Fare il controllo legale prima di scrivere il giudizio',
  diffamazione: 'Diffamazione: il giudizio finale è supportato da fatti verificati, non da supposizioni? (art. 595 c.p.)',
  continenza: 'Continenza: il tono resta proporzionato al fatto, anche se crudo?',
  gdpr_minori: 'GDPR / minori: ci sono volti, nomi o dati di persone comuni o di minori? Serve oscurare/anonimizzare?',
  copyright: 'Copyright: immagini/video sono nostri, con licenza, o citati nei limiti del diritto di critica?',
  rettifica: 'Piano di rettifica: sappiamo come correggere se sbagliamo?',
};

const GATE_LABELS: Readonly<Record<string, string>> = {
  ...CHECK_LABELS,
  fonti: 'Manca almeno una fonte',
  scrittore: 'Manca chi scrive',
  rilettore: 'Manca chi rilegge',
  rilettura: 'Manca il sì di chi rilegge',
};

export function gateLines(status: { ok: boolean; missing: string[] }): string[] {
  if (status.ok) return [];
  return status.missing.flatMap((key) => Object.hasOwn(GATE_LABELS, key) ? [GATE_LABELS[key]] : []);
}
