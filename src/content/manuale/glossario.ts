import type { Section } from './index';

// Manuale dimostrativo di una redazione immaginaria.
export const glossario: Section = {
  id: 'glossario',
  title: 'Glossario',
  blocks: [
    { kind: 'p', text: 'Alcune parole ricorrenti nel lavoro del Faro Comune, spiegate in modo semplice.' },
    { kind: 'h', level: 2, text: 'Fonti e riscontri' },
    { kind: 'h', level: 3, text: 'Fonte primaria' },
    { kind: 'p', text: 'Il documento o la testimonianza più vicina al fatto raccontato, come un atto originale o una dichiarazione registrata.' },
    { kind: 'h', level: 3, text: 'Riscontro indipendente' },
    { kind: 'p', text: 'Una conferma ottenuta da un’origine distinta dalla prima, utile per controllare informazioni importanti.' },
    { kind: 'h', level: 2, text: 'Scrittura' },
    { kind: 'h', level: 3, text: 'Attribuzione' },
    { kind: 'p', text: 'L’indicazione chiara di chi ha fornito un dato, espresso un’opinione o compiuto un’azione.' },
    { kind: 'h', level: 3, text: 'Contesto' },
    { kind: 'p', text: 'Le informazioni che permettono di capire quando, dove e in quali condizioni è avvenuto un fatto.' },
    { kind: 'h', level: 3, text: 'Rettifica' },
    { kind: 'p', text: 'Una modifica pubblica che corregge un’informazione inesatta, accompagnata da una spiegazione comprensibile.' },
    { kind: 'h', level: 2, text: 'Pubblicazione' },
    { kind: 'h', level: 3, text: 'Licenza' },
    { kind: 'p', text: 'Le condizioni che stabiliscono come un materiale può essere riutilizzato e quali indicazioni devono accompagnarlo.' },
    { kind: 'h', level: 3, text: 'Dato personale' },
    { kind: 'p', text: 'Un’informazione che identifica o può rendere identificabile una persona. Va trattata con attenzione e solo per uno scopo motivato.' },
    { kind: 'p', text: 'Le definizioni sono sintetiche e hanno funzione didattica; per approfondire si consultano fonti autorevoli e aggiornate.' },
  ],
};
