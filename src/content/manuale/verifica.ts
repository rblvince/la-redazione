import type { Section } from './index';

// Manuale dimostrativo di una redazione immaginaria.
export const verifica: Section = {
  id: 'verifica',
  title: 'Verifica',
  blocks: [
    { kind: 'p', text: 'Al Faro Comune ogni notizia passa per cinque controlli. Se mancano elementi essenziali, attendiamo oppure descriviamo con precisione il limite.' },
    { kind: 'h', level: 2, text: 'Il percorso di controllo' },
    { kind: 'h', level: 3, text: '1 — Isolare l\'affermazione centrale' },
    { kind: 'p', text: 'Scriviamo in una frase quale fatto concreto stiamo cercando di accertare. Se contiene più affermazioni, le dividiamo.' },
    { kind: 'h', level: 3, text: '2 — Trovare la fonte primaria, non un rilancio' },
    { kind: 'p', text: 'Cerchiamo il documento, il dato o la dichiarazione originale da cui nasce l’informazione. Un resoconto altrui può orientare la ricerca ma non sostituisce l’origine.' },
    { kind: 'h', level: 3, text: '3 — Leggere la fonte per intero' },
    { kind: 'p', text: 'Controlliamo il documento nel suo insieme, la data, l’autore e il contesto. Una frase estratta può cambiare significato se separata dal resto.' },
    { kind: 'h', level: 3, text: '4 — Cercare un secondo riscontro se la notizia è delicata' },
    { kind: 'p', text: 'Per dati contestati o conseguenze rilevanti chiediamo conferma indipendente. Annotiamo anche le divergenze tra fonti e ciò che non è stato possibile stabilire.' },
    { kind: 'h', level: 3, text: '5 — Fare il controllo legale prima di scrivere il giudizio' },
    { kind: 'p', text: 'Rivediamo nomi, immagini, dati personali e formulazioni che attribuiscono responsabilità. Nei dubbi sospendiamo la pubblicazione e chiediamo un parere competente.' },
    { kind: 'h', level: 2, text: 'Tracciare il lavoro' },
    { kind: 'p', text: 'Per ogni affermazione conserviamo riferimento, data di consultazione e appunto sul riscontro ottenuto. Distinguiamo fatti confermati, dichiarazioni attribuite e aspetti ancora incerti.' },
    { kind: 'h', level: 2, text: 'Una fonte utile' },
    { kind: 'p', text: 'Per orientarsi sul trattamento dei dati personali consultiamo il sito dell’autorità competente e verifichiamo la pagina aggiornata.' },
    { kind: 'link', label: 'Garante per la protezione dei dati personali', href: 'https://www.garanteprivacy.it/' },
    { kind: 'p', text: 'Il collegamento è un punto di partenza informativo, non sostituisce una valutazione del caso concreto.' },
  ],
};
