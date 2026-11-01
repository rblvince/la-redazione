import Link from 'next/link';
import { Icon } from '@/components/shell/Icon';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  title: string;
  /** Una riga che dice cosa fare adesso. */
  hint?: string;
  action?: { href: string; label: string };
  /** `error` = qualcosa non ha funzionato: l'avviso è annunciato e porta il segno dell'errore, non solo il rosso. */
  tone?: 'empty' | 'error';
};

export function EmptyState({ title, hint, action, tone = 'empty' }: EmptyStateProps) {
  const error = tone === 'error';
  return (
    <div className={`${styles.box} ${error ? styles.error : ''}`} role={error ? 'alert' : undefined}>
      {error ? (
        <Icon name="alert" size={28} className={styles.mark} />
      ) : (
        // Il quadratino tratteggiato è il segno di "manca" dei voti: qui manca un tema.
        <span className={styles.slot} aria-hidden="true" />
      )}
      <p className={styles.title}>{title}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {action ? (
        <Link href={action.href} className={styles.action}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
