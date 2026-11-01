import Link from 'next/link';
import { DesktopShell } from '@/components/shell/DesktopShell';
import type { Vote } from '@/components/shell/VoteSquares';
import { groupBoard, type BoardResult, type BoardTopic, type BoardView } from '@/lib/queries/board';
import type { Stage } from '@/lib/domain/stage';
import styles from './BoardScreen.module.css';
import { EmptyState } from './EmptyState';
import { GroupHeader } from './GroupHeader';
import { NewTopicSheet } from './NewTopicSheet';
import { TopicRow } from './TopicRow';

export const BOARD_VIEWS: { key: BoardView; label: string }[] = [
  { key: 'da_decidere', label: 'Da decidere' },
  { key: 'decisi', label: 'Decisi' },
  { key: 'parcheggiati', label: 'Parcheggiati' },
];

export function parseView(value: string | string[] | undefined): BoardView {
  const raw = Array.isArray(value) ? value[0] : value;
  return BOARD_VIEWS.find((view) => view.key === raw)?.key ?? 'da_decidere';
}

export function viewHref(view: BoardView, open = false): string {
  const params = new URLSearchParams();
  if (view !== 'da_decidere') params.set('vista', view);
  if (open) params.set('nuovo', '1');
  const query = params.toString();
  return query ? `/temi?${query}` : '/temi';
}

const EMPTY: Record<BoardView, { title: string; hint: string }> = {
  da_decidere: { title: 'Niente da decidere.', hint: 'Butta dentro il prossimo tema.' },
  decisi: { title: 'Nessun tema deciso, per ora.', hint: 'Quando un tema passa, lo trovi qui con la sua fase.' },
  parcheggiati: { title: 'Nessun tema parcheggiato.', hint: 'Un decisore può parcheggiare un tema; chiunque può riattivarlo.' },
};

// Un tema "fermo" ha senso solo mentre qualcuno deve ancora muoverlo.
const CAN_STALL: Stage[] = ['da_decidere', 'verifica', 'legale'];
const DAY = 86_400_000;

export function ViewSwitch({ view }: { view: BoardView }) {
  return (
    <nav aria-label="Vista della bacheca" className={styles.switch}>
      <ul>
        {BOARD_VIEWS.map((item) => (
          <li key={item.key}>
            <Link
              href={viewHref(item.key)}
              className={`${styles.seg} ${item.key === view ? styles.segOn : ''}`}
              aria-current={item.key === view ? 'page' : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type Context = {
  names: Map<string, string>;
  voters: { id: string; name: string }[];
  stale: Set<string>;
  now: Date;
  /** Il tema aperto accanto all'elenco, se c'è. */
  selectedId?: string;
};

function rows(topics: BoardTopic[], ctx: Context, mode: 'votes' | 'stage') {
  return topics.map((topic) => {
    const votes: Vote[] = ctx.voters.map((voter) => ({
      name: voter.name,
      value: topic.votes.find((vote) => vote.voterId === voter.id)?.value ?? null,
    }));
    return (
      <TopicRow
        key={topic.id}
        id={topic.id}
        title={topic.title}
        format={topic.format}
        linkSite={topic.link_site}
        authorName={ctx.names.get(topic.proposed_by) ?? null}
        idleDays={Math.max(0, Math.floor((ctx.now.getTime() - new Date(topic.last_activity_at).getTime()) / DAY))}
        stale={ctx.stale.has(topic.id) && CAN_STALL.includes(topic.stage)}
        votes={mode === 'votes' ? votes : undefined}
        stage={mode === 'stage' ? topic.stage : undefined}
        linkTitle={topic.link_title}
        commentCount={topic.comment_count}
        selected={topic.id === ctx.selectedId}
      />
    );
  });
}

/** Stabile: i fermi vengono prima, il resto resta nell'ordine di attività che arriva dalla query. */
function stalledFirst(topics: BoardTopic[], stale: Set<string>): BoardTopic[] {
  return [...topics].sort((a, b) => Number(stale.has(b.id)) - Number(stale.has(a.id)));
}

export function Board({
  result,
  view,
  now,
  selectedId,
}: {
  result: Extract<BoardResult, { ok: true }>;
  view: BoardView;
  now: Date;
  selectedId?: string;
}) {
  const { topics, me, people, deciders, staleDays } = result;
  const grouped = groupBoard(topics, me.id, deciders, staleDays, now);
  const ctx: Context = {
    names: new Map(people.map((person) => [person.id, person.display_name])),
    voters: deciders.map((id) => ({ id, name: people.find((person) => person.id === id)?.display_name ?? '?' })),
    stale: grouped.stale,
    now,
    selectedId,
  };

  if (topics.length === 0) {
    const empty = EMPTY[view];
    return (
      <EmptyState
        title={empty.title}
        hint={empty.hint}
        action={view === 'da_decidere' ? { href: viewHref(view, true), label: 'Nuovo tema' } : undefined}
      />
    );
  }

  if (view !== 'da_decidere') {
    return (
      <ul className={styles.list}>{rows(stalledFirst(topics, grouped.stale), ctx, view === 'decisi' ? 'stage' : 'votes')}</ul>
    );
  }

  const canVote = deciders.includes(me.id);
  return (
    <>
      {canVote ? (
        <section>
          <GroupHeader title="Tocca a te" count={grouped.mine.length} />
          {grouped.mine.length > 0 ? (
            <ul className={styles.list}>{rows(stalledFirst(grouped.mine, grouped.stale), ctx, 'votes')}</ul>
          ) : (
            <p className={styles.clear}>Hai votato tutto.</p>
          )}
        </section>
      ) : null}
      {grouped.others.length > 0 ? (
        <section>
          <GroupHeader title="Aspettano gli altri" count={grouped.others.length} />
          <ul className={styles.list}>{rows(stalledFirst(grouped.others, grouped.stale), ctx, 'votes')}</ul>
        </section>
      ) : null}
    </>
  );
}

/** La bacheca intera: guscio, selettore, gruppi, stati e pannello "Nuovo tema". Lo usa la rotta `/temi`. */
export function BoardScreen({ result, view, open, now }: { result: BoardResult; view: BoardView; open: boolean; now: Date }) {
  const names = result.ok
    ? result.people.filter((person) => person.active && person.role !== 'manutentore').map((person) => person.display_name)
    : [];
  // Il manutentore resta in sola lettura: niente "Nuovo tema", e `?nuovo=1` non apre il pannello.
  const canPropose = !result.ok || result.me.role !== 'manutentore';
  return (
    <>
      <DesktopShell
        current="temi"
        title="Temi"
        canPropose={canPropose}
        newTopicHref={viewHref(view, true)}
        people={names}
        list={
          <>
            <ViewSwitch view={view} />
            {result.ok ? (
              <Board result={result} view={view} now={now} />
            ) : (
              <EmptyState tone="error" title="La bacheca non si carica." hint={result.message} action={{ href: viewHref(view), label: 'Riprova' }} />
            )}
          </>
        }
      >
        <div className={styles.idle}>
          <p className={styles.idleTitle}>Nessun tema aperto</p>
          <p className={styles.idleHint}>Scegline uno dall&apos;elenco, oppure butta dentro il prossimo.</p>
        </div>
      </DesktopShell>
      {open && canPropose ? <NewTopicSheet closeHref={viewHref(view)} /> : null}
    </>
  );
}
