import type { Metadata } from 'next';
import { connection } from 'next/server';
import { WorkScreen } from '@/components/work/WorkScreen';
import { loadWork } from '@/lib/queries/work';

export const metadata: Metadata = { title: 'In lavoro' };

/** I temi in verifica o in legale e rilettura, divisi in "Scrivi tu", "Rileggi tu" e "Altri". */
export default async function InLavoroPage() {
  // L'ora cambia a ogni richiesta: la pagina si costruisce quando arriva, non in anticipo.
  await connection();
  const result = await loadWork();
  return <WorkScreen result={result} now={new Date()} />;
}
