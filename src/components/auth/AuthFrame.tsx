import type { ReactNode } from 'react';
import styles from './AuthFrame.module.css';

/**
 * Cornice delle pagine fuori dal guscio (accesso, invito, errori, "non trovato").
 * Un foglio solo, con il filetto acido in alto: lo stesso segno dei pannelli dell'app.
 */
export function AuthFrame({ title, lead, children, wide = false }: { title: string; lead?: string; children?: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className={styles.page}>
      <p className={styles.brand}>
        Redazione<span>.</span>
      </p>
      <section className={`${styles.sheet} ${wide ? styles.wide : ''}`} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>
          {title}
        </h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children}
      </section>
      <p className={styles.foot}>Spazio privato della redazione.</p>
    </main>
  );
}
