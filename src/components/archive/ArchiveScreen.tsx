import Link from 'next/link';
import { EmptyState } from '@/components/board/EmptyState';
import { GroupHeader } from '@/components/board/GroupHeader';
import { formatLabel } from '@/components/board/formats';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { IdlePane } from '@/components/shell/IdlePane';
import { Icon } from '@/components/shell/Icon';
import { Pill } from '@/components/shell/Pill';
import { safeHref } from '@/lib/domain/url';
import type { ArchiveResult, ArchiveTopic } from '@/lib/queries/archive';
import styles from './ArchiveScreen.module.css';

export const MAX_QUERY = 100;

/** `?q=` arriva dall'indirizzo: è testo di chiunque. Qui si ripulisce solo per mostrarlo; il filtro vero è `archiveFilter`. */
export function parseQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
}

const fullDate = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' });

function publishedOn(topic: ArchiveTopic): string {
  const date = new Date(topic.published_at ?? topic.created_at);
  return Number.isNaN(date.getTime()) ? '' : fullDate.format(date);
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function ArchiveRow({ topic }: { topic: ArchiveTopic }) {
  // L'indirizzo del post è scritto da una persona: senza https valido non diventa un link.
  const post = safeHref(topic.post_url);
  const host = post ? hostOf(post) : '';
  const formato = formatLabel(topic.format);
  return (
    <li className={styles.row}>
      <Link href={`/tema/${topic.id}`} className={styles.main}>
        <span className={styles.title}>{topic.title}</span>
        {topic.body ? <span className={styles.snippet}>{topic.body}</span> : null}
        <span className={styles.meta}>
          <span>{publishedOn(topic)}</span>
          {formato ? <Pill>{formato}</Pill> : null}
        </span>
      </Link>
      {post ? (
        <a
          href={post}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.post}
          aria-label={`Apri il post${host ? ` su ${host}` : ''} (si apre in una nuova scheda)`}
        >
          <Icon name="link" size={16} />
          Post
        </a>
      ) : null}
    </li>
  );
}

function SearchForm({ q }: { q: string }) {
  return (
    <form method="get" action="/archivio" role="search" className={styles.search}>
      <div className={styles.labelRow}>
        <label htmlFor="archivio-q" className={styles.label}>
          Cerca nell&apos;archivio
        </label>
        {q ? (
          <Link href="/archivio" className={styles.reset}>
            Azzera
          </Link>
        ) : null}
      </div>
      <div className={styles.controls}>
        <input
          id="archivio-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={MAX_QUERY}
          placeholder="Titolo o testo"
          autoComplete="off"
          enterKeyHint="search"
          className={styles.input}
        />
        <button type="submit" className={styles.submit}>
          Cerca
        </button>
      </div>
    </form>
  );
}

/** "Archivio": i pezzi pubblicati e la ricerca. La ricerca è un modulo GET: funziona anche senza JavaScript. */
export function ArchiveScreen({ result, q }: { result: ArchiveResult; q: string }) {
  return (
    <DesktopShell
      current="archivio"
      title="Archivio"
      canPropose
      list={
        <>
          <SearchForm q={q} />
          {!result.ok ? (
            <EmptyState
              tone="error"
              title="L'archivio non si carica."
              hint={result.message}
              action={{ href: q ? `/archivio?q=${encodeURIComponent(q)}` : '/archivio', label: 'Riprova' }}
            />
          ) : result.topics.length === 0 ? (
            q ? (
              <EmptyState
                title={`Nessun risultato per «${q}».`}
                hint="Prova con una parola sola, oppure azzera la ricerca."
                action={{ href: '/archivio', label: 'Azzera la ricerca' }}
              />
            ) : (
              <EmptyState
                title="Ancora niente di pubblicato."
                hint="Il primo pezzo che passa il cancello finisce qui, con le sue fonti e il suo storico."
                action={{ href: '/in-lavoro', label: 'Vedi cosa è in lavoro' }}
              />
            )
          ) : (
            <section>
              <div aria-live="polite">
                <GroupHeader title={q ? `Risultati per «${q}»` : 'Pubblicati'} count={result.topics.length} />
              </div>
              <ul className={styles.list}>
                {result.topics.map((topic) => (
                  <ArchiveRow key={topic.id} topic={topic} />
                ))}
              </ul>
            </section>
          )}
        </>
      }
    >
      <IdlePane title="Nessun pezzo aperto" hint="Scegli un pezzo dall'elenco: trovi le fonti, chi ha verificato e lo storico." />
    </DesktopShell>
  );
}
