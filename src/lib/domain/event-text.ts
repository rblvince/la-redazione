import { CHECK_LABELS } from '@/lib/domain/gate-view';

export type TopicEvent = { kind: string; actor_id: string | null; data: Record<string, unknown> | null };
export type EventPeople = Record<string, { display_name: string }>;

export function describeEvent(e: TopicEvent, peopleById: EventPeople): string {
  const actor = e.actor_id === null ? 'Manutenzione' : peopleById[e.actor_id]?.display_name || 'Qualcuno';
  const data = e.data ?? {};
  const check = typeof data.item === 'string' && Object.hasOwn(CHECK_LABELS, data.item)
    ? CHECK_LABELS[data.item] : null;
  const person = (id: unknown) => typeof id === 'string' ? peopleById[id]?.display_name || 'Qualcuno' : 'Qualcuno';
  switch (e.kind) {
    case 'proposto': return `${actor} ha proposto il tema`;
    case 'commento': return `${actor} ha commentato`;
    case 'votato': return `${actor} ha votato ${data.value === true ? 'sì' : data.value === false ? 'no' : 'sul tema'}`;
    case 'deciso': return e.actor_id === null ? 'Il tema è stato approvato' : `${actor} ha approvato il tema`;
    case 'parcheggiato': return `${actor} ha parcheggiato il tema`;
    case 'riattivato': return `${actor} ha riattivato il tema`;
    case 'persone_assegnate': return `${actor} ha assegnato ${person(data.writer_id)} alla scrittura e ${person(data.reviewer_id)} alla rilettura`;
    case 'spunta': return check ? `${actor} ha spuntato «${check}»` : `${actor} ha aggiornato una spunta`;
    case 'spunta_tolta': return check ? `${actor} ha tolto la spunta a «${check}»` : `${actor} ha aggiornato una spunta`;
    case 'fonte_aggiunta': return `${actor} ha aggiunto una fonte`;
    case 'fonte_eliminata': return `${actor} ha eliminato una fonte`;
    case 'rilettura_approvata': return `${actor} ha approvato la rilettura`;
    case 'pubblicato': return `${actor} ha segnato il tema come pubblicato`;
    case 'rettifica': return `${actor} ha aggiunto una rettifica`;
    default: return `${actor} ha aggiornato il tema`;
  }
}
