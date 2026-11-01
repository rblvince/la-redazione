import styles from './StageBar.module.css';
import type { Stage } from '@/lib/domain/stage';

export type { Stage } from '@/lib/domain/stage';

const TICKS = ['Proposta', 'Verifica', 'Legale', 'Rilettura', 'Pubblicato'] as const;
type TickState = 'done' | 'cur' | 'todo';

/** Quante tacche sono fatte e quale è in corso (-1 = nessuna). */
function progress(stage: Stage, reviewApproved: boolean): { done: number; cur: number } {
  switch (stage) {
    case 'da_decidere':
      return { done: 0, cur: 0 };
    case 'verifica':
      return { done: 1, cur: 1 };
    case 'legale':
      return reviewApproved ? { done: 4, cur: 4 } : { done: 2, cur: 2 };
    case 'pubblicato':
      return { done: 5, cur: -1 };
    case 'parcheggiato':
      return { done: 0, cur: -1 };
  }
}

export function StageBar({ stage, reviewApproved }: { stage: Stage; reviewApproved: boolean }) {
  const { done, cur } = progress(stage, reviewApproved);
  const states: TickState[] = TICKS.map((_, i) => (i < done ? 'done' : i === cur ? 'cur' : 'todo'));
  const parked = stage === 'parcheggiato';
  const ready = stage === 'legale' && reviewApproved;
  const name = parked ? 'Parcheggiato' : ready ? 'Rilettura approvata' : cur >= 0 ? TICKS[cur] : 'Pubblicato';
  const position = parked ? null : ready ? 4 : cur >= 0 ? cur + 1 : 5;

  return (
    <div>
      <ol className={styles.ticks} aria-label="Fasi del tema">
        {TICKS.map((tick, i) => (
          <li key={tick} className={`${styles.tick} ${styles[states[i]]}`}>
            <span className="sr-only">
              {tick}: {states[i] === 'done' ? 'fatta' : states[i] === 'cur' ? 'in corso' : 'da fare'}
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.label}>
        <b>{position ? `${position}/5 · ${name}` : name}</b>
        <span aria-hidden="true">{TICKS.join(' · ')}</span>
      </p>
    </div>
  );
}
