'use client';

import { DesktopShell } from '@/components/shell/DesktopShell';
import styles from '../../temi/error.module.css';

/** Errore imprevisto della pagina del tema. Il testo non porta dettagli interni: la causa resta nei log del server. */
export default function TemaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DesktopShell current="temi" title="Temi" list={<span />} phoneShows="detail" back={{ href: '/temi', label: 'Temi' }}>
      <div className={styles.box} role="alert">
        <p className={styles.title}>Il tema non si carica.</p>
        <p className={styles.hint}>Succede, di solito è la connessione. Quello che hai scritto fin qui è al sicuro.</p>
        <button type="button" className={styles.retry} onClick={() => reset()}>
          Riprova
        </button>
      </div>
    </DesktopShell>
  );
}
