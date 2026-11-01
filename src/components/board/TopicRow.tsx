import Link from 'next/link';
import { Icon } from '@/components/shell/Icon';
import { Pill } from '@/components/shell/Pill';
import { VoteSquares, type Vote } from '@/components/shell/VoteSquares';
import type { Stage } from '@/lib/domain/stage';
import { formatLabel } from './formats';
import styles from './TopicRow.module.css';

export type TopicRowProps = {
  id: string;
  /** Testo libero: si mostra sempre come testo. */
  title: string;
  format: string | null;
  /** Solo testo (il dominio del link). La riga è già un link: niente `<a>` annidato. */
  linkSite: string | null;
  authorName: string | null;
  /** Giorni interi dall'ultima attività. */
  idleDays: number;
  stale: boolean;
  /** Se presente, i voti del giro corrente come quadratini. */
  votes?: Vote[];
  /** Se presente, la fase (per i temi già decisi). */
  stage?: Stage;
  /** Titolo della pagina collegata: testo libero, si mostra solo come testo. */
  linkTitle?: string | null;
  commentCount?: number;
  /** Il tema aperto accanto all'elenco (da 1024px). */
  selected?: boolean;
};

const STAGE_LABEL: Partial<Record<Stage, string>> = {
  verifica: 'Verifica',
  legale: 'Legale e rilettura',
  pubblicato: 'Pubblicato',
};

function age(days: number): string {
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} gg fa`;
}

export function TopicRow({
  id,
  title,
  format,
  linkSite,
  authorName,
  idleDays,
  stale,
  votes,
  stage,
  linkTitle,
  commentCount = 0,
  selected = false,
}: TopicRowProps) {
  const formato = formatLabel(format);
  const stageLabel = stage ? STAGE_LABEL[stage] : undefined;
  return (
    <li>
      <Link
        href={`/tema/${id}`}
        className={`${styles.row} ${selected ? styles.selected : ''}`}
        aria-current={selected ? 'page' : undefined}
      >
        <span className={styles.body}>
          <span className={styles.title}>{title}</span>
          {linkTitle ? <span className={styles.linkTitle}>{linkTitle}</span> : null}
          <span className={styles.meta}>
            {stale ? (
              <span className={styles.stale}>
                <Icon name="alert" size={14} />
                fermo da {idleDays} gg
              </span>
            ) : (
              <span>{age(idleDays)}</span>
            )}
            {stageLabel ? <Pill>{stageLabel}</Pill> : null}
            {formato ? <Pill>{formato}</Pill> : null}
            {authorName ? <span>{authorName}</span> : null}
            {commentCount > 0 ? <span>{commentCount === 1 ? '1 commento' : `${commentCount} commenti`}</span> : null}
            {linkSite ? (
              <span className={styles.site}>
                <Icon name="link" size={13} />
                {linkSite}
              </span>
            ) : null}
          </span>
        </span>
        {votes && votes.length > 0 ? <VoteSquares votes={votes} /> : null}
      </Link>
    </li>
  );
}
