import type { Section } from './index';

// Manuale dimostrativo di una redazione immaginaria.
export const legislazione: Section = {
  id: 'legislazione',
  title: 'Attenzione alle regole',
  blocks: [
    { kind: 'p', text: 'Questa sezione ricorda cautele generali per il lavoro editoriale. Non è consulenza legale e non descrive un caso reale.' },
    { kind: 'h', level: 2, text: 'Accuratezza e reputazione' },
    { kind: 'p', text: 'Prima di attribuire un comportamento a una persona, verifichiamo i fatti, distinguiamo le accuse dalle decisioni accertate e chiediamo una risposta con tempi ragionevoli.' },
    { kind: 'p', text: 'Un titolo non deve trasformare un dubbio in una certezza. Le parole usate devono corrispondere alle prove disponibili e al ruolo di ciascuno.' },
    { kind: 'p', text: 'Annotiamo i tentativi di contatto e riportiamo le risposte in modo fedele, senza alterarne il senso.' },
    { kind: 'h', level: 2, text: 'Dati personali' },
    { kind: 'p', text: 'Raccogliamo soltanto le informazioni necessarie alla storia. Valutiamo con particolare cura la pubblicazione di dettagli privati, immagini e dati che riguardano persone vulnerabili.' },
    { kind: 'p', text: 'Quando una persona è riconoscibile, ci domandiamo se identificarla sia davvero utile per comprendere il tema.' },
    { kind: 'p', text: 'Evitiamo di conservare copie superflue e limitiamo l’accesso ai materiali raccolti durante il lavoro.' },
    { kind: 'h', level: 2, text: 'Materiali di terzi' },
    { kind: 'p', text: 'Testi, fotografie, grafici e registrazioni possono avere condizioni d’uso diverse. Controlliamo titolarità e licenza, citiamo la provenienza e chiediamo autorizzazione quando serve.' },
    { kind: 'h', level: 2, text: 'Risposte e correzioni' },
    { kind: 'p', text: 'Registriamo le richieste di chiarimento o rettifica e le valutiamo senza ritardo. Se correggiamo un contenuto, rendiamo comprensibile che cosa è cambiato.' },
    { kind: 'h', level: 2, text: 'Consultare fonti aggiornate' },
    { kind: 'p', text: 'Le norme e le indicazioni possono cambiare. Per una verifica concreta usiamo fonti istituzionali aggiornate e, quando necessario, chiediamo assistenza qualificata.' },
    { kind: 'link', label: 'Garante per la protezione dei dati personali', href: 'https://www.garanteprivacy.it/' },
    { kind: 'p', text: 'Le scelte descritte sono esempi didattici per una redazione immaginaria.' },
  ],
};
