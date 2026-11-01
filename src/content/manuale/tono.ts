import type { Section } from './index';

// Manuale dimostrativo di una redazione immaginaria.
export const tono: Section = {
  id: 'tono',
  title: 'Tono di voce',
  blocks: [
    { kind: 'p', text: 'Il Faro Comune scrive con parole semplici e precise. Il tono è vicino alle persone, senza imitare il parlato o cercare effetti facili.' },
    { kind: 'h', level: 2, text: 'Una voce chiara' },
    { kind: 'list', items: [
      'Preferire frasi brevi quando rendono più facile seguire un passaggio.',
      'Spiegare sigle e termini tecnici al primo uso.',
      'Indicare chi ha compiuto un’azione e quando è avvenuta.',
      'Usare numeri con unità, periodo e contesto.',
      'Attribuire giudizi e dichiarazioni alla persona che li esprime.',
    ] },
    { kind: 'h', level: 2, text: 'Rispetto senza distanza' },
    { kind: 'p', text: 'La cortesia non richiede formule rigide. Si può essere diretti senza umiliare, ironici senza confondere i fatti e coinvolgenti senza alzare artificialmente i toni.' },
    { kind: 'h', level: 3, text: 'Prima della pubblicazione' },
    { kind: 'p', text: 'Rileggiamo il testo chiedendoci se una persona nuova nel tema capirebbe la notizia, se il titolo promette ciò che l’articolo dimostra e se ogni aggettivo ha una ragione.' },
    { kind: 'h', level: 3, text: 'Quando una frase pesa' },
    { kind: 'p', text: 'Se una parola può ferire o suggerire una colpa, controlliamo che sia necessaria e sostenuta dai fatti. Le caratteristiche personali entrano nel racconto solo quando sono pertinenti.' },
    { kind: 'p', text: 'Un esempio inventato: invece di dire “il progetto è un disastro”, descriviamo quali scadenze sono saltate e quali spiegazioni sono state fornite.' },
    { kind: 'h', level: 2, text: 'Coerenza' },
    { kind: 'p', text: 'La stessa misura vale per ogni interlocutore. Il nostro stile deve rendere più leggibile il lavoro, non sostituirsi alle prove.' },
    { kind: 'p', text: 'Queste indicazioni sono parte di un manuale dimostrativo.' },
  ],
};
