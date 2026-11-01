'use client';

import { useRef, useState } from 'react';
import common from '@/components/topic/common.module.css';
import styles from './ConfirmAction.module.css';

/**
 * Azione che si può rimpiangere (disattivare una persona, revocare un invito): la conferma sta nella riga,
 * non in una finestra. Al primo tocco compare la domanda con "Sì" e "Annulla"; il focus va su "Annulla"
 * (la scelta sicura) e torna al pulsante di partenza se si annulla.
 */
export function ConfirmAction({
  label,
  question,
  yes,
  pending,
  onConfirm,
}: {
  label: string;
  /** La domanda, in chiaro: dice a chi e che cosa succede. */
  question: string;
  yes: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  if (!asking) {
    return (
      <button
        ref={trigger}
        type="button"
        className={`${common.btn} ${common.ghost} ${common.sm}`}
        disabled={pending}
        onClick={() => {
          setAsking(true);
          requestAnimationFrame(() => cancel.current?.focus());
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={styles.ask} role="group" aria-label={question}>
      <p className={styles.question}>{question}</p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${common.btn} ${common.sm} ${styles.danger}`}
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            onConfirm();
            setAsking(false);
          }}
        >
          {yes}
        </button>
        <button
          ref={cancel}
          type="button"
          className={`${common.btn} ${common.ghost} ${common.sm}`}
          onClick={() => {
            setAsking(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
