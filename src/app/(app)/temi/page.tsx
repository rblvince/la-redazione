import type { Metadata } from 'next';
import { BoardScreen, parseView } from '@/components/board/BoardScreen';
import { loadBoard } from '@/lib/queries/board';

export const metadata: Metadata = { title: 'Temi' };

/**
 * La bacheca. `?vista=` sceglie tra Da decidere (predefinita), Decisi e Parcheggiati.
 * `?nuovo=1` apre il pannello "Nuovo tema": scelto al posto di una rotta `/temi/nuovo` perché la bacheca resta
 * dietro e, chiudendo, si torna alla stessa vista; il link profondo arriva già aperto dal server.
 */
export default async function TemiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const view = parseView(params.vista);
  const result = await loadBoard(view);
  return <BoardScreen result={result} view={view} open={params.nuovo === '1'} now={new Date()} />;
}
