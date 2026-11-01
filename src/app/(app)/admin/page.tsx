import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { loadAdmin } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Amministrazione' };

/**
 * Solo il manutentore. Il controllo è qui, sul server: `loadAdmin` risponde `forbidden` a chiunque altro
 * (anche a chi non è entrato) e la pagina finisce nel "non trovato", senza dire che esiste.
 */
export default async function AdminPage() {
  // L'ora cambia a ogni richiesta: la pagina si costruisce quando arriva, non in anticipo.
  await connection();
  const result = await loadAdmin();
  if (!result.ok && 'forbidden' in result) notFound();
  return <AdminScreen result={result} now={new Date()} />;
}
