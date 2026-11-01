import { Pill } from '@/components/shell/Pill';
import { Icon } from '@/components/shell/Icon';
import { safeHref } from '@/lib/domain/url';
import { SourceActions } from './SourceActions';
import { shortDate } from './time';
import { personName, type PeopleById, type TopicData } from './types';
import styles from './SourceList.module.css';

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

/**
 * Fonti del tema. Titolo e dominio sono testo. Il link esiste solo se `safeHref` lo accetta.
 * Lo screenshot non si carica qui: parte dal tasto "Vedi screenshot", con un indirizzo firmato a scadenza.
 */
export function SourceList({
  sources,
  people,
  meId,
  stage,
  readOnly,
}: {
  sources: TopicData['sources'];
  people: PeopleById;
  meId: string;
  stage: TopicData['topic']['stage'];
  readOnly: boolean;
}) {
  if (sources.length === 0) {
    return <p className={styles.empty}>Nessuna fonte per ora. Serve almeno la primaria.</p>;
  }
  return (
    <ul className={styles.list}>
      {sources.map((source) => {
        const href = safeHref(source.url);
        return (
          <li key={source.id} className={styles.src}>
            <div className={styles.head}>
              <Pill tone={source.kind === 'primaria' ? 'on' : 'gold'}>{source.kind === 'primaria' ? 'Primaria' : 'Secondaria'}</Pill>
              <p className={styles.title}>{source.title}</p>
            </div>
            <p className={styles.meta}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  <Icon name="link" size={13} />
                  {hostOf(href)}
                  <span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
              ) : (
                <span className={styles.bad}>Link non mostrato: non è un indirizzo https valido</span>
              )}
              <span>
                {personName(people, source.added_by)} · {shortDate(source.created_at)}
              </span>
            </p>
            {source.screenshot_path || (!readOnly && source.added_by === meId && stage !== 'pubblicato') ? (
              <SourceActions
                sourceId={source.id}
                title={source.title}
                hasScreenshot={Boolean(source.screenshot_path)}
                canDelete={!readOnly && source.added_by === meId && stage !== 'pubblicato'}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
