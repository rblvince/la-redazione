'use client';

import Link from 'next/link';
import { AuthFrame } from '@/components/auth/AuthFrame';
import common from '@/components/topic/common.module.css';
import styles from '@/components/auth/AuthForm.module.css';

/** Errore imprevisto fuori dalle schermate dell'app. Niente dettagli interni: la causa resta nei log del server. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <AuthFrame title="Qualcosa si è rotto" lead="Non è colpa tua. Quello che avevi già salvato è al sicuro.">
      <div className={styles.actions} role="alert">
        <button type="button" className={`${common.btn} ${common.sm}`} onClick={() => retry()}>
          Riprova
        </button>
        <Link href="/temi" className={`${common.btn} ${common.ghost} ${common.sm}`}>
          Vai ai temi
        </Link>
      </div>
    </AuthFrame>
  );
}
