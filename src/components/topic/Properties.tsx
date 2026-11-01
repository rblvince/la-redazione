import { Icon } from '@/components/shell/Icon';
import { formatLabel } from '@/components/board/formats';
import { safeHref } from '@/lib/domain/url';
import { shortDate } from './time';
import { Person } from './Person';
import { personName, type PeopleById, type TopicData } from './types';
import styles from './Properties.module.css';

/** Dati della proposta. Tutto ciò che viene da persone o da pagine altrui si mostra come testo. */
export function Properties({ topic, people, meId }: { topic: TopicData['topic']; people: PeopleById; meId: string }) {
  const format = formatLabel(topic.format);
  const href = safeHref(topic.link_url);
  const linkText = topic.link_title || topic.link_site || topic.link_url;
  return (
    <dl className={styles.props}>
      <div className={styles.row}>
        <dt>Proposto</dt>
        <dd>
          <Person name={personName(people, topic.proposed_by)} me={topic.proposed_by === meId} />
          <span className={styles.when}>{shortDate(topic.created_at)}</span>
        </dd>
      </div>
      <div className={styles.row}>
        <dt>Formato</dt>
        <dd>{format ?? <span className={styles.none}>Non scelto</span>}</dd>
      </div>
      {topic.link_url ? (
        <div className={styles.row}>
          <dt>Link</dt>
          <dd className={styles.link}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                <Icon name="link" size={14} />
                <span>{linkText}</span>
                <span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            ) : (
              <span className={styles.plain}>
                <Icon name="link" size={14} />
                <span>{linkText}</span>
              </span>
            )}
            {topic.link_site && topic.link_title ? <span className={styles.site}>{topic.link_site}</span> : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
