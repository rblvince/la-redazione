'use client';

import { useState } from 'react';
import { deleteSourceAction, sourceScreenshotUrlAction } from '@/app/(app)/tema/[id]/actions';
import { safeHref } from '@/lib/domain/url';
import { Notice } from './Notice';
import { useAction } from './useAction';
import common from './common.module.css';
import styles from './SourceActions.module.css';

type Props = {
  sourceId: string;
  title: string;
  hasScreenshot: boolean;
  canDelete: boolean;
};

/**
 * Comandi di una fonte. Lo screenshot si chiede solo al tocco e si mostra solo se l'indirizzo firmato
 * passa `safeHref`. Eliminare chiede una seconda conferma.
 */
export function SourceActions({ sourceId, title, hasScreenshot, canDelete }: Props) {
  const [shot, setShot] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { pending, notice, setNotice, run } = useAction();

  async function loadShot() {
    if (asking) return;
    setAsking(true);
    setNotice(null);
    try {
      const result = await sourceScreenshotUrlAction(sourceId);
      const href = result.ok ? safeHref(result.url) : null;
      if (!result.ok) setNotice({ tone: 'error', text: result.message });
      else if (!href) setNotice({ tone: 'error', text: 'Lo screenshot non è disponibile in modo sicuro.' });
      else setShot(href);
    } catch {
      setNotice({ tone: 'error', text: 'Non sono riuscito a caricare lo screenshot. Riprova.' });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        {hasScreenshot ? (
          shot ? (
            <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} onClick={() => setShot(null)}>
              Nascondi screenshot
            </button>
          ) : (
            <button
              type="button"
              className={`${common.btn} ${common.ghost} ${common.sm}`}
              onClick={loadShot}
              disabled={asking}
              aria-busy={asking}
            >
              {asking ? 'Carico…' : 'Vedi screenshot'}
            </button>
          )
        ) : null}
        {canDelete ? (
          confirming ? (
            <>
              <button
                type="button"
                className={`${common.btn} ${common.ghost} ${common.sm} ${styles.danger}`}
                disabled={pending}
                onClick={() => run(() => deleteSourceAction(sourceId), 'Fonte eliminata.')}
              >
                {pending ? 'Elimino…' : 'Sì, elimina'}
              </button>
              <button
                type="button"
                className={`${common.btn} ${common.ghost} ${common.sm}`}
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Annulla
              </button>
            </>
          ) : (
            <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} onClick={() => setConfirming(true)}>
              Elimina
              <span className="sr-only"> la fonte {title}</span>
            </button>
          )
        ) : null}
      </div>
      {shot ? (
        // Indirizzo firmato a scadenza e già validato: non passa da next/image, che lo scaricherebbe in anticipo.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shot} alt={`Screenshot salvato della fonte: ${title}`} className={styles.shot} referrerPolicy="no-referrer" />
      ) : null}
      <Notice notice={notice} />
    </div>
  );
}
