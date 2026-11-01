import styles from './IdlePane.module.css';

/** Colonna del dettaglio quando non c'è niente di aperto: dice cosa fare. Da 1024px accanto all'elenco. */
export function IdlePane({ title, hint }: { title: string; hint: string }) {
  return (
    <div className={styles.idle}>
      <p className={styles.title}>{title}</p>
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
