import { EmptyState } from '@/components/board/EmptyState';
import { GroupHeader } from '@/components/board/GroupHeader';
import boardStyles from '@/components/board/BoardScreen.module.css';
import { TopicRow } from '@/components/board/TopicRow';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { IdlePane } from '@/components/shell/IdlePane';
import { sidebarNames } from '@/components/shell/sidebar';
import type { WorkResult, WorkTopic } from '@/lib/queries/work';

const DAY = 86_400_000;

type GroupKey = 'write' | 'review' | 'others';

const EMPTY_LINE: Record<GroupKey, string> = {
  write: 'Non stai scrivendo niente, per ora.',
  review: 'Non hai niente da rileggere.',
  others: 'Nessun altro tema in lavoro.',
};

/** Chi fa che cosa, in una riga. Dal punto di vista di chi guarda: l'altro ruolo è quello che gli serve sapere. */
function who(topic: WorkTopic, group: GroupKey, names: Map<string, string>): string {
  const writer = topic.writer_id ? (names.get(topic.writer_id) ?? 'qualcuno') : null;
  const reviewer = topic.reviewer_id ? (names.get(topic.reviewer_id) ?? 'qualcuno') : null;
  const waiting = topic.stage === 'legale' && !topic.review_approved_at;
  if (group === 'write') {
    if (!reviewer) return 'Ancora senza chi rilegge';
    return `Rilegge ${reviewer}${topic.review_approved_at ? ' · rilettura approvata' : ''}`;
  }
  if (group === 'review') {
    const base = writer ? `Scrive ${writer}` : 'Ancora senza chi scrive';
    return waiting ? `${base} · aspetta il tuo sì` : base;
  }
  if (writer && reviewer) return `${writer} scrive, ${reviewer} rilegge`;
  if (writer) return `${writer} scrive, manca chi rilegge`;
  return 'Da assegnare';
}

function Group({
  title,
  group,
  topics,
  names,
  now,
  stale,
}: {
  title: string;
  group: GroupKey;
  topics: WorkTopic[];
  names: Map<string, string>;
  now: Date;
  stale: Set<string>;
}) {
  return (
    <section>
      <GroupHeader title={title} count={topics.length} />
      {topics.length > 0 ? (
        <ul className={boardStyles.list}>
          {topics.map((topic) => (
            <TopicRow
              key={topic.id}
              id={topic.id}
              title={topic.title}
              format={topic.format}
              linkSite={topic.link_site}
              authorName={who(topic, group, names)}
              idleDays={Math.max(0, Math.floor((now.getTime() - new Date(topic.last_activity_at).getTime()) / DAY))}
              stale={stale.has(topic.id)}
              stage={topic.stage}
              linkTitle={topic.link_title}
            />
          ))}
        </ul>
      ) : (
        <p className={boardStyles.clear}>{EMPTY_LINE[group]}</p>
      )}
    </section>
  );
}

/** "In lavoro": i temi in verifica o in legale e rilettura, divisi per ruolo di chi guarda. */
export function WorkScreen({ result, now }: { result: WorkResult; now: Date }) {
  const names = result.ok ? new Map(result.people.map((person) => [person.id, person.display_name])) : new Map<string, string>();
  const canPropose = !result.ok || result.me.role !== 'manutentore';
  // Il manutentore non scrive né rilegge: per lui i gruppi personali sarebbero sempre vuoti.
  const staleSet = result.ok ? result.stale : new Set<string>();
  const personal = result.ok && result.me.role !== 'manutentore';
  return (
    <DesktopShell
      current="in-lavoro"
      title="In lavoro"
      canPropose={canPropose}
      people={result.ok ? sidebarNames(result.people) : []}
      counts={result.ok ? { 'in-lavoro': result.topics.length } : {}}
      adminHref={result.ok && result.me.role === 'manutentore' ? '/admin' : undefined}
      list={
        !result.ok ? (
          <EmptyState tone="error" title="L'elenco non si carica." hint={result.message} action={{ href: '/in-lavoro', label: 'Riprova' }} />
        ) : result.topics.length === 0 ? (
          <EmptyState
            title="Niente in lavoro."
            hint="Quando un tema passa il voto va in verifica e compare qui, con chi scrive e chi rilegge."
            action={{ href: '/temi', label: 'Vai ai temi' }}
          />
        ) : (
          <>
            {personal ? (
              <>
                <Group title="Scrivi tu" group="write" topics={result.groups.write} names={names} now={now} stale={staleSet} />
                <Group title="Rileggi tu" group="review" topics={result.groups.review} names={names} now={now} stale={staleSet} />
              </>
            ) : null}
            <Group title={personal ? 'Altri' : 'In lavoro'} group="others" topics={result.groups.others} names={names} now={now} stale={staleSet} />
          </>
        )
      }
    >
      <IdlePane title="Nessun tema aperto" hint="Scegli un tema dall'elenco: si apre con le sue verifiche e il cancello." />
    </DesktopShell>
  );
}
