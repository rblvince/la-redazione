'use client';

import { useRef, useState, useTransition } from 'react';
import { inviteAction } from '@/app/(app)/admin/actions';
import common from '@/components/topic/common.module.css';
import { Icon } from '@/components/shell/Icon';
import { ROLE_HINT } from './roles';
import styles from './InviteForm.module.css';

const NETWORK_ERROR = 'Non sono riuscito a creare l’invito. Controlla la connessione e riprova.';

/** Il link d'invito è una credenziale: vive solo in questo stato, non in indirizzo, storage o log. */
type Created = { url: string; email: string };

/**
 * "Invita persona". L'app non manda email: l'invito produce un link che chi invita consegna a mano.
 * La logica (token, scadenza, ruolo) è tutta nell'azione del server; qui si raccoglie e si mostra.
 */
export function InviteForm({ initialLink }: { initialLink?: Created }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(initialLink ?? null);
  const [copied, setCopied] = useState<'ok' | 'manual' | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    setError(null);
    startTransition(async () => {
      try {
        const result = await inviteAction(data);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (!result.link) {
          setError('L’invito è stato creato ma il link non è arrivato. Controlla l’elenco degli inviti e riprova.');
          return;
        }
        setCopied(null);
        setCreated({ url: result.link, email });
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied('ok');
    } catch {
      // Niente appunti (contesto non sicuro o permesso negato): il campo si seleziona, si copia a mano.
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopied('manual');
    }
  }

  function another() {
    setCreated(null);
    setCopied(null);
    setError(null);
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  if (created) {
    return (
      <div className={styles.done}>
        <p className={styles.doneTitle}>
          <Icon name="check" size={18} />
          <span>
            Invito pronto per <span className={styles.email}>{created.email}</span>
          </span>
        </p>
        <label htmlFor="invite-link" className={common.label}>
          Link d&apos;invito
        </label>
        <div className={styles.linkRow}>
          <input
            id="invite-link"
            ref={linkRef}
            className={`${common.field} ${common.mono} ${styles.link}`}
            value={created.url}
            readOnly
            spellCheck={false}
            autoComplete="off"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className={`${common.btn} ${common.sm}`} onClick={copy}>
            <Icon name="copy" size={15} />
            Copia link
          </button>
        </div>
        <div className={common.live} aria-live="polite" aria-atomic="true">
          {copied === 'ok' ? (
            <p className={`${common.notice} ${common.noticeOk}`}>
              <Icon name="check" size={16} />
              <span>Link copiato.</span>
            </p>
          ) : copied === 'manual' ? (
            <p className={common.notice}>
              <Icon name="alert" size={16} />
              <span>Non riesco a copiarlo da solo: il link è selezionato, copialo con la tastiera.</span>
            </p>
          ) : null}
        </div>
        <ul className={styles.facts}>
          <li>L&apos;app non manda nessuna email: il link lo consegni tu, di persona o in un messaggio.</li>
          <li>Vale 7 giorni, si usa una volta sola e funziona solo con questa email.</li>
          <li>Dopo la chiusura di questa pagina non si può rivedere: se lo perdi, revoca l&apos;invito e creane un altro.</li>
        </ul>
        <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} onClick={another}>
          Invita un&apos;altra persona
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate={false}>
      <label htmlFor="invite-email" className={common.label}>
        Email della persona
      </label>
      <input
        id="invite-email"
        ref={emailRef}
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="off"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome@esempio.it"
        className={common.field}
        aria-describedby={error ? 'invite-error' : 'invite-email-hint'}
        aria-invalid={error ? true : undefined}
        disabled={pending}
      />
      <p id="invite-email-hint" className={common.hint}>
        Deve essere la stessa email con cui la persona entrerà.
      </p>

      <fieldset className={styles.roles} disabled={pending}>
        <legend className={common.label}>Ruolo</legend>
        {(['membro', 'decisore'] as const).map((role) => (
          <label key={role} className={styles.role}>
            <input type="radio" name="role" value={role} defaultChecked={role === 'membro'} className={styles.radio} />
            <span>
              <span className={styles.roleName}>{role === 'membro' ? 'Membro' : 'Decisore'}</span>
              <span className={styles.roleHint}>{ROLE_HINT[role]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className={common.live} aria-live="polite" aria-atomic="true" id="invite-error">
        {error ? (
          <p className={`${common.notice} ${common.noticeErr}`}>
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={pending} aria-busy={pending}>
        {pending ? 'Creo l’invito…' : 'Crea invito'}
      </button>
    </form>
  );
}
