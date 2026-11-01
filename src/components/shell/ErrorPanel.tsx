'use client';

import { DesktopShell, type ShellProps } from './DesktopShell';
import styles from '@/app/(app)/temi/error.module.css';

/** Errore imprevisto dentro il guscio: la navigazione resta, il testo non porta dettagli interni. */
export function ErrorPanel({ current, title, retry }: { current: ShellProps['current']; title: string; retry: () => void }) {
  return (
    <DesktopShell current={current} title={title} list={<span />} phoneShows="detail" canPropose={false}>
      <div className={styles.box} role="alert">
        <p className={styles.title}>Questa schermata non si carica.</p>
        <p className={styles.hint}>Succede, di solito è la connessione. Quello che era già salvato resta salvato.</p>
        <button type="button" className={styles.retry} onClick={retry}>
          Riprova
        </button>
      </div>
    </DesktopShell>
  );
}
