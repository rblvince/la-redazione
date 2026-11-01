'use client';

import { castVoteAction, parkTopicAction, reactivateTopicAction } from '@/app/(app)/tema/[id]/actions';
import { Icon } from '@/components/shell/Icon';
import { VoteSquares, type Vote } from '@/components/shell/VoteSquares';
import { Notice } from './Notice';
import { useAction } from './useAction';
import common from './common.module.css';
import styles from './DecisionBar.module.css';

type Props = {
  topicId: string;
  stage: 'da_decidere' | 'parcheggiato';
  /** Decisore attivo: può votare e parcheggiare. */
  canVote: boolean;
  /** Decisore o membro: può riattivare un tema parcheggiato. */
  canReactivate: boolean;
  /** Il mio voto del giro corrente (null = non ho votato). */
  myVote: boolean | null;
  votes: Vote[];
  summary: string;
};

/**
 * Barra delle decisioni, ancorata in basso (sopra la barra di navigazione sul telefono).
 * Mostra sempre lo stato dei voti; i comandi compaiono solo a chi può usarli.
 */
export function DecisionBar({ topicId, stage, canVote, canReactivate, myVote, votes, summary }: Props) {
  const { pending, notice, run } = useAction();
  const parked = stage === 'parcheggiato';

  return (
    <section className={styles.bar} aria-label={parked ? 'Riattivazione' : 'Decisione'} aria-busy={pending}>
      {!parked ? (
        <div className={styles.status}>
          {votes.length > 0 ? <VoteSquares votes={votes} /> : null}
          <p className={styles.summary}>{summary}</p>
        </div>
      ) : (
        <p className={styles.summary}>Parcheggiato: nessuno lo sta lavorando.</p>
      )}

      {!parked && canVote ? (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${common.btn} ${common.ghost} ${styles.btn}`}
            disabled={pending}
            onClick={() => run(() => parkTopicAction(topicId), 'Tema parcheggiato.')}
          >
            Parcheggia
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.ghost} ${styles.btn} ${styles.no} ${myVote === false ? styles.pressedNo : ''}`}
            aria-pressed={myVote === false}
            disabled={pending}
            onClick={() => run(() => castVoteAction(topicId, false), 'Hai votato no.')}
          >
            {myVote === false ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
            No
          </button>
          <button
            type="button"
            className={`${common.btn} ${styles.btn} ${myVote === true ? styles.pressedYes : ''}`}
            aria-pressed={myVote === true}
            disabled={pending}
            onClick={() => run(() => castVoteAction(topicId, true), 'Hai votato sì.')}
          >
            {myVote === true ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
            Sì, si fa
          </button>
        </div>
      ) : null}

      {!parked && !canVote ? <p className={styles.hint}>Votano solo i decisori. Tu puoi commentare.</p> : null}

      {parked && canReactivate ? (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${common.btn} ${styles.btn} ${styles.wide}`}
            disabled={pending}
            onClick={() => run(() => reactivateTopicAction(topicId), 'Tema riattivato.')}
          >
            Riattiva
          </button>
        </div>
      ) : null}

      <Notice notice={notice} />
    </section>
  );
}
