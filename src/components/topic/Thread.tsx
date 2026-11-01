import { describeEvent } from '@/lib/domain/event-text';
import { Avatar } from './Person';
import { personName, type PeopleById, type TopicData } from './types';
import { whenAgo } from './time';
import styles from './Thread.module.css';

type Entry =
  | { type: 'comment'; key: string; at: string; authorId: string; body: string }
  | { type: 'event'; key: string; at: string; text: string };

/**
 * Discussione: commenti ed eventi in ordine di tempo. Gli eventi sono frasi (`describeEvent`);
 * il commento ha già la sua voce, quindi l'evento "commento" si salta. Tutto è testo, mai HTML.
 */
export function Thread({
  comments,
  events,
  people,
  meId,
  now,
  showEvents = true,
}: {
  comments: TopicData['comments'];
  events: TopicData['events'];
  people: PeopleById;
  meId: string;
  now: Date;
  showEvents?: boolean;
}) {
  const entries: Entry[] = [
    ...comments.map<Entry>((comment) => ({
      type: 'comment',
      key: `c-${comment.id}`,
      at: comment.created_at,
      authorId: comment.author_id,
      body: comment.body,
    })),
    ...(showEvents
      ? events
          .filter((event) => event.kind !== 'commento')
          .map<Entry>((event) => ({
            type: 'event',
            key: `e-${event.id}`,
            at: event.created_at,
            text: describeEvent(event, people),
          }))
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (entries.length === 0) {
    return <p className={styles.empty}>Ancora nessun commento. Scrivi tu il primo.</p>;
  }

  return (
    <ol className={styles.thread}>
      {entries.map((entry) =>
        entry.type === 'comment' ? (
          <li key={entry.key} className={styles.msg}>
            <Avatar name={personName(people, entry.authorId)} me={entry.authorId === meId} />
            <div className={styles.content}>
              <p className={styles.who}>
                <b>{personName(people, entry.authorId)}</b>
                <time dateTime={entry.at}>{whenAgo(entry.at, now)}</time>
              </p>
              <p className={styles.body}>{entry.body}</p>
            </div>
          </li>
        ) : (
          <li key={entry.key} className={styles.ev}>
            <span>{entry.text}</span>
            <time dateTime={entry.at}>{whenAgo(entry.at, now)}</time>
          </li>
        ),
      )}
    </ol>
  );
}
