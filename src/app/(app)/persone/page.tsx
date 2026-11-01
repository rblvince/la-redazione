import type { Metadata } from 'next';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import { loadPeople } from '@/lib/queries/people';

export const metadata: Metadata = { title: 'Persone' };

/** Chi c'è in redazione. `?invita=1` porta direttamente al modulo d'invito (utile sul telefono). */
export default async function PersonePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = await loadPeople();
  return <PeopleScreen result={result} invita={params.invita === '1'} />;
}
