import type { TopicResult } from '@/lib/queries/topic';

/** Il tema caricato bene: è ciò che la pagina passa alle schermate. */
export type TopicData = Extract<TopicResult, { ok: true }>;

export type PeopleById = Record<string, { display_name: string }>;

export function peopleMap(data: Pick<TopicData, 'people'>): PeopleById {
  return Object.fromEntries(data.people.map((person) => [person.id, { display_name: person.display_name }]));
}

export function personName(people: PeopleById, id: string | null): string {
  if (!id) return 'Manutenzione';
  return people[id]?.display_name ?? 'Qualcuno';
}
