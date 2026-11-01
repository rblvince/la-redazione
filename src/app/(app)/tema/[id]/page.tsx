import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/board/EmptyState';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { TopicList } from '@/components/topic/TopicList';
import { TopicScreen, backHref } from '@/components/topic/TopicScreen';
import { loadTopic } from '@/lib/queries/topic';

export const metadata: Metadata = { title: 'Tema' };

/**
 * Il tema, in tutte le fasi. Il database decide che cosa si vede: qui si compone la pagina.
 * L'elenco accanto (da 1024px) arriva a parte, così il tema non aspetta la bacheca.
 */
export default async function TemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadTopic(id);
  if (!result.ok) {
    if ('notFound' in result) notFound();
    return (
      <DesktopShell current="temi" title="Temi" list={<span />} phoneShows="detail" back={{ href: backHref('da_decidere'), label: 'Temi' }}>
        <EmptyState tone="error" title="Il tema non si carica." hint={result.message} action={{ href: `/tema/${id}`, label: 'Riprova' }} />
      </DesktopShell>
    );
  }
  return (
    <TopicScreen
      data={result}
      now={new Date()}
      list={
        <Suspense fallback={<p role="status" style={{ padding: '12px 14px', color: 'var(--dim)' }}>Carico l&apos;elenco…</p>}>
          <TopicList stage={result.topic.stage} selectedId={result.topic.id} />
        </Suspense>
      }
    />
  );
}
