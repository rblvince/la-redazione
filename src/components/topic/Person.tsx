import styles from './Person.module.css';

/** Quadratino con l'iniziale più il nome: il nome c'è sempre come testo, l'iniziale è solo decorazione. */
export function Person({ name, me = false }: { name: string; me?: boolean }) {
  return (
    <span className={styles.person}>
      <span className={`${styles.av} ${me ? styles.me : ''}`} aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      {name}
    </span>
  );
}

export function Avatar({ name, me = false }: { name: string; me?: boolean }) {
  return (
    <span className={`${styles.av} ${me ? styles.me : ''}`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
