'use client';

import { useId, useState, type FormEvent } from 'react';
import { approveReviewAction, publishTopicAction } from '@/app/(app)/tema/[id]/actions';
import { Icon } from '@/components/shell/Icon';
import { gateLines } from '@/lib/domain/gate-view';
import { safeHref } from '@/lib/domain/url';
import { Notice } from './Notice';
import { useAction } from './useAction';
import type { TopicGate } from '@/lib/queries/topic';
import common from './common.module.css';
import styles from './Gate.module.css';

type Props = {
  topicId: string;
  stage: 'verifica' | 'legale';
  gate: TopicGate;
  reviewerName: string | null;
  /** La rilettura è già stata approvata (dato del tema, non dedotto dalle mancanze). */
  reviewApproved: boolean;
  /** Chi ha dato il sì alla rilettura, se c'è. */
  approvedBy: string | null;
  isWriter: boolean;
  isReviewer: boolean;
};

type Line = { key: string; text: string; tone: 'wait' | 'bad' };

function lines(gate: TopicGate): Line[] {
  // Una chiave alla volta, così ogni frase tiene la sua chiave e `gateLines` continua a scartare quelle sconosciute.
  return gate.missing.flatMap((key) => {
    const text = gateLines({ ok: false, missing: [key] })[0];
    return text ? [{ key, text, tone: key === 'rilettura' ? ('wait' as const) : ('bad' as const) }] : [];
  });
}

/**
 * Il cancello: elenca ciò che manca prima di poter pubblicare, ospita il sì di chi rilegge
 * e il modulo "Segna pubblicato". Il bottone resta spento finché il database dice che manca qualcosa.
 */
export function Gate({ topicId, stage, gate, reviewerName, reviewApproved, approvedBy, isWriter, isReviewer }: Props) {
  const id = useId();
  const [postUrl, setPostUrl] = useState('');
  const approve = useAction();
  const publish = useAction();
  const missing = lines(gate);
  const open = gate.ok;
  const approved = reviewApproved && stage === 'legale';
  const canPublish = isWriter || isReviewer;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = postUrl.trim();
    if (!safeHref(url)) {
      publish.setNotice({ tone: 'error', text: 'Il link del post deve iniziare con https:// ed essere un sito vero.' });
      return;
    }
    publish.run(() => publishTopicAction(topicId, url), 'Segnato come pubblicato.');
  }

  const reason = !canPublish
    ? 'Può segnarlo come pubblicato solo chi scrive o chi rilegge.'
    : !open
      ? 'Prima chiudi il cancello: mancano le cose qui sopra.'
      : null;

  return (
    <div className={styles.gate}>
      <div className={`${styles.header} ${open ? styles.open : ''}`}>
        <Icon name={open ? 'ok' : 'clock'} size={22} />
        <div>
          <p className={styles.state}>
            {open ? 'Tutto a posto' : missing.length === 1 ? 'Manca 1 cosa' : `Mancano ${missing.length} cose`}
          </p>
          <p className={styles.sub}>{open ? 'Si può segnare come pubblicato.' : 'Il resto è a posto.'}</p>
        </div>
      </div>

      {missing.length > 0 ? (
        <ul className={styles.lines}>
          {missing.map((line) => (
            <li key={line.key} className={styles.line}>
              <Icon name={line.tone === 'wait' ? 'clock' : 'x'} size={18} className={line.tone === 'wait' ? styles.wait : styles.bad} />
              <span>{line.text}</span>
              <span className="sr-only">{line.tone === 'wait' ? ' (in attesa)' : ' (manca)'}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {stage === 'legale' ? (
        <div className={styles.review} aria-busy={approve.pending}>
          {approved ? (
            <p className={styles.done}>
              <Icon name="ok" size={18} />
              Rilettura approvata{approvedBy ? ` da ${approvedBy}` : ''}.
            </p>
          ) : isReviewer ? (
            <>
              <button
                type="button"
                className={`${common.btn} ${common.ghost}`}
                disabled={approve.pending}
                onClick={() => approve.run(() => approveReviewAction(topicId), 'Rilettura approvata.')}
              >
                {approve.pending ? 'Salvo…' : 'Approva la rilettura'}
              </button>
              <Notice notice={approve.notice} />
            </>
          ) : isWriter ? (
            <p className={styles.lock}>
              <Icon name="lock" size={16} />
              Chi scrive non può rileggersi{reviewerName ? `: aspetta il sì di ${reviewerName}.` : '.'}
            </p>
          ) : (
            <p className={styles.lock}>
              <Icon name="clock" size={16} />
              {reviewerName ? `Aspetta il sì di ${reviewerName}.` : 'Nessuno rilegge ancora.'}
            </p>
          )}
        </div>
      ) : null}

      <form className={styles.publish} onSubmit={submit} noValidate aria-busy={publish.pending}>
        <label className={common.label} htmlFor={`${id}-post`}>
          Link del post pubblicato
        </label>
        <input
          id={`${id}-post`}
          type="url"
          inputMode="url"
          className={`${common.field} ${common.mono}`}
          value={postUrl}
          onChange={(event) => setPostUrl(event.target.value)}
          placeholder="https://"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={!canPublish || publish.pending}
          aria-describedby={reason ? `${id}-motivo` : undefined}
        />
        <button
          type="submit"
          className={`${common.btn} ${styles.submit}`}
          disabled={!canPublish || !open || publish.pending}
          aria-busy={publish.pending}
        >
          {publish.pending ? 'Segno…' : 'Segna pubblicato'}
        </button>
        {reason ? (
          <p id={`${id}-motivo`} className={styles.reason}>
            <Icon name="lock" size={14} />
            {reason}
          </p>
        ) : null}
        <Notice notice={publish.notice} />
      </form>
    </div>
  );
}
