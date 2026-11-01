import styles from './GroupHeader.module.css';

/** Intestazione di un gruppo dell'elenco: titolo e quanti sono. Il titolo è un `h2` (sotto l'`h1` del guscio). */
export function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.group}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.count}>
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">{count === 1 ? '1 tema' : `${count} temi`}</span>
      </p>
    </div>
  );
}
