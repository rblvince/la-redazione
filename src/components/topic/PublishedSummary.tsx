import { Icon } from '@/components/shell/Icon';
import { formatLabel } from '@/components/board/formats';
import { describeEvent } from '@/lib/domain/event-text';
import { safeHref } from '@/lib/domain/url';
import { Person } from './Person';
import { shortDate } from './time';
import { personName, type PeopleById, type TopicData } from './types';
import { CorrectionForm } from './CorrectionForm';
import { Section } from './Section';
import styles from './PublishedSummary.module.css';

function hostPath(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return href;
  }
}

function PostLink({ url }: { url: string | null }) {
  const href = safeHref(url);
  if (!url) return <span className={styles.none}>Manca</span>;
  if (!href) return <span className={styles.plain}>{url}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.post}>
      <Icon name="link" size={14} />
      <span>{hostPath(href)}</span>
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

/**
 * Tema pubblicato: link al post, chi ha scritto e riletto, fonti, rettifiche e storico. Le rettifiche
 * si aggiungono, non si cancellano. Autori, motivi e testi sono sempre testo.
 */
export function PublishedSummary({
  data,
  people,
  readOnly,
}: {
  data: TopicData;
  people: PeopleById;
  readOnly: boolean;
}) {
  const { topic, sources, corrections, events } = data;
  const primary = sources.filter((source) => source.kind === 'primaria').length;
  const history = events.filter((event) => event.kind !== 'commento');
  return (
    <>
      <Section id="pubblicazione" title="Pubblicazione">
        <dl className={styles.props}>
          <div className={styles.row}>
            <dt>Post</dt>
            <dd>
              <PostLink url={topic.post_url} />
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Formato</dt>
            <dd>{formatLabel(topic.format) ?? <span className={styles.none}>Non scelto</span>}</dd>
          </div>
          <div className={styles.row}>
            <dt>Scritto</dt>
            <dd>{topic.writer_id ? <Person name={personName(people, topic.writer_id)} /> : <span className={styles.none}>—</span>}</dd>
          </div>
          <div className={styles.row}>
            <dt>Riletto</dt>
            <dd>{topic.reviewer_id ? <Person name={personName(people, topic.reviewer_id)} /> : <span className={styles.none}>—</span>}</dd>
          </div>
          <div className={styles.row}>
            <dt>Fonti</dt>
            <dd>
              {sources.length} · {primary} {primary === 1 ? 'primaria' : 'primarie'}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Rettifiche</dt>
            <dd>{corrections.length === 0 ? <span className={styles.none}>Nessuna</span> : corrections.length}</dd>
          </div>
        </dl>
      </Section>

      <Section id="rettifiche" title="Rettifiche" note={corrections.length > 0 ? String(corrections.length) : undefined}>
        {corrections.length > 0 ? (
          <ol className={styles.corrections}>
            {corrections.map((correction) => {
              const href = safeHref(correction.new_post_url);
              return (
                <li key={correction.id} className={styles.correction}>
                  <p className={styles.cMeta}>
                    <b>{personName(people, correction.author_id)}</b>
                    <time dateTime={correction.created_at}>{shortDate(correction.created_at)}</time>
                  </p>
                  <p className={styles.text}>{correction.body}</p>
                  <p className={styles.why}>
                    <span>Perché</span> {correction.reason}
                  </p>
                  {correction.new_post_url ? (
                    <p className={styles.newLink}>
                      <span>Nuovo link</span>{' '}
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {hostPath(href)}
                          <span className="sr-only"> (si apre in una nuova scheda)</span>
                        </a>
                      ) : (
                        correction.new_post_url
                      )}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.empty}>Nessuna rettifica. Se sbagliamo, la aggiungiamo qui sotto: resta scritta.</p>
        )}
        {readOnly ? null : <CorrectionForm topicId={topic.id} />}
      </Section>

      {history.length > 0 ? (
        <Section id="storico" title="Storico">
          <ol className={styles.history}>
            {history.map((event) => (
              <li key={event.id}>
                <time dateTime={event.created_at}>{shortDate(event.created_at)}</time>
                <span>{describeEvent(event, people)}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </>
  );
}
