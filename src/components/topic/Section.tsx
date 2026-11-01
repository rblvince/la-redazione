import type { ReactNode } from 'react';
import styles from './common.module.css';

/** Sezione della pagina del tema: `h2` (sotto l'`h1` del titolo) più, a destra, una nota breve. */
export function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titolo`} className={styles.section}>
      <div className={styles.head}>
        <h2 id={`${id}-titolo`} className={styles.title}>
          {title}
        </h2>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
