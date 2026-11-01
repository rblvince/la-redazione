import { Board, ViewSwitch } from '@/components/board/BoardScreen';
import { EmptyState } from '@/components/board/EmptyState';
import { loadBoard } from '@/lib/queries/board';
import { viewForStage } from './TopicScreen';
import type { TopicData } from './types';

/**
 * La colonna dell'elenco accanto al tema (da 1024px). Su telefono non si vede.
 * Se la bacheca non si carica, il tema aperto resta leggibile: qui compare solo un avviso piccolo.
 */
export async function TopicList({ stage, selectedId }: { stage: TopicData['topic']['stage']; selectedId: string }) {
  const view = viewForStage(stage);
  const result = await loadBoard(view);
  return (
    <>
      <ViewSwitch view={view} />
      {result.ok ? (
        <Board result={result} view={view} now={new Date()} selectedId={selectedId} />
      ) : (
        <EmptyState tone="error" title="L'elenco non si carica." hint={result.message} action={{ href: `/tema/${selectedId}`, label: 'Riprova' }} />
      )}
    </>
  );
}
