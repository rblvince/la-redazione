import type { Section } from './index';

// Manuale dimostrativo di una redazione immaginaria.
export const manifesto: Section = {
  id: 'manifesto',
  title: 'Manifesto',
  blocks: [
    { kind: 'p', text: 'La redazione del Faro Comune racconta ciò che accade nel quartiere immaginario di Valleverde.' },
    { kind: 'h', level: 2, text: 'Il nostro compito' },
    { kind: 'p', text: 'Offriamo notizie comprensibili, controllate e utili alla vita quotidiana. Ogni storia deve aiutare chi legge a orientarsi, senza chiedergli di appartenere a una parte.' },
    { kind: 'h', level: 2, text: 'Principi di lavoro' },
    { kind: 'list', items: [
      'Separiamo ciò che sappiamo da ciò che stiamo ancora accertando.',
      'Rendiamo visibili le fonti e spieghiamo come le abbiamo usate.',
      'Diamo spazio alle persone coinvolte e descriviamo con precisione le loro risposte.',
      'Correggiamo con chiarezza gli errori che troviamo.',
      'Scegliamo titoli fedeli al contenuto e al contesto.',
    ] },
    { kind: 'h', level: 2, text: 'La comunità al centro' },
    { kind: 'p', text: 'Una domanda dei lettori può diventare l’inizio di un lavoro, mai la prova di una conclusione. La redazione valuta ogni proposta con lo stesso metodo e protegge la dignità di chi non ha voce pubblica.' },
    { kind: 'p', text: 'Non confondiamo urgenza e fretta: prima di pubblicare controlliamo i dettagli essenziali e segnaliamo ciò che resta incerto.' },
    { kind: 'h', level: 2, text: 'Responsabilità' },
    { kind: 'p', text: 'Chi firma un testo ne cura accuratezza e tono. Un collega rilegge i passaggi delicati. Le decisioni editoriali si motivano con elementi verificabili e si possono rivedere quando arrivano informazioni nuove.' },
    { kind: 'p', text: 'Questo testo descrive una redazione inventata ed è incluso a scopo dimostrativo.' },
  ],
};
