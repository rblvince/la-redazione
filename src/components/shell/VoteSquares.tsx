import styles from './VoteSquares.module.css';

export type Vote = { name: string; value: boolean | null };

function label(vote: Vote): string {
  if (vote.value === true) return `${vote.name}: sì`;
  if (vote.value === false) return `${vote.name}: no`;
  return `${vote.name}: non ha ancora votato`;
}

/**
 * Un quadrato per persona. Sì = pieno acido, no = pieno rosso con l'angolo tagliato
 * (il segno non dipende solo dal colore), manca = tratteggiato. Il nome c'è sempre come testo.
 */
export function VoteSquares({ votes }: { votes: Vote[] }) {
  return (
    <ul className={styles.votes}>
      {votes.map((vote) => (
        <li
          key={vote.name}
          className={`${styles.sq} ${vote.value === true ? styles.yes : vote.value === false ? styles.no : styles.none}`}
        >
          <span aria-hidden="true">{vote.name.trim().charAt(0).toUpperCase()}</span>
          <span className="sr-only">{label(vote)}</span>
        </li>
      ))}
    </ul>
  );
}
