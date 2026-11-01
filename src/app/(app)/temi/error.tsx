'use client';

import { DesktopShell } from '@/components/shell/DesktopShell';
import styles from './error.module.css';

/** Errore imprevisto della bacheca. Il testo non porta dettagli interni: la causa resta nei log del server. */
export default function TemiError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DesktopShell
      current="temi"
      title="Temi"
      list={
        <div className={styles.box} role="alert">
          <p className={styles.title}>La bacheca non si carica.</p>
          <p className={styles.hint}>Succede, di solito è la connessione. I temi non si sono persi.</p>
          <button type="button" className={styles.retry} onClick={() => reset()}>
            Riprova
          </button>
        </div>
      }
    >
      <span />
    </DesktopShell>
  );
}
