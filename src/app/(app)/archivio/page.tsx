import type { Metadata } from 'next';
import { ArchiveScreen, parseQuery } from '@/components/archive/ArchiveScreen';
import { loadArchive } from '@/lib/queries/archive';

export const metadata: Metadata = { title: 'Archivio' };

/** I pezzi pubblicati. `?q=` cerca nel titolo e nel testo: è un modulo GET, funziona anche senza JavaScript. */
export default async function ArchivioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = parseQuery(params.q);
  const result = await loadArchive(q);
  return <ArchiveScreen result={result} q={q} />;
}
