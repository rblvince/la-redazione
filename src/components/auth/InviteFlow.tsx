'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { acceptInviteAction, startInviteLoginAction, verifyInviteCodeAction } from '@/app/invito/[token]/actions';
import { Icon } from '@/components/shell/Icon';
import common from '@/components/topic/common.module.css';
import { forgetInviteStep, recallInviteStep, rememberInviteStep } from '@/lib/domain/code-step';
import { OTP_LENGTH } from '@/lib/domain/otp';
import { safeNext } from '@/lib/domain/safe-next';
import styles from './AuthForm.module.css';

const NETWORK_ERROR = 'Non sono riuscito a completare la richiesta. Controlla la connessione e riprova.';
const NAME_KEY = 'redazione:nome-invito';

/** Chiave legata al singolo invito, senza il token in chiaro: prefisso più 8 caratteri dell'hash SHA-256. Senza `crypto.subtle` (contesto non sicuro) non si salva niente. */
async function storageKey(token: string): Promise<string | null> {
  try {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hex = Array.from(new Uint8Array(digest).slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${NAME_KEY}:${hex}`;
  } catch {
    return null;
  }
}

async function remember(token: string, name: string) {
  try {
    const key = await storageKey(token);
    if (key) window.localStorage.setItem(key, name);
  } catch {
    // Privato o bloccato: al secondo passo il nome si riscrive, nient'altro.
  }
}

async function recall(token: string): Promise<string> {
  try {
    const key = await storageKey(token);
    return key ? (window.localStorage.getItem(key) ?? '') : '';
  } catch {
    return '';
  }
}

/** Invito riscattato: il nome ricordato non serve più. */
async function forget(token: string) {
  try {
    const key = await storageKey(token);
    if (key) window.localStorage.removeItem(key);
  } catch {
    // Niente da cancellare o storage chiuso: non cambia l'esito dell'invito.
  }
}

/**
 * Il nome e il codice stanno sulla stessa pagina; chi torna da un vecchio link può riscattare direttamente.
 * Qui si raccolgono i dati; invio, verifica e riscatto sono azioni del server.
 */
export function InviteFlow({ token, email, step }: { token: string; email: string; step: 1 | 2 }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    void recallInviteStep(token).then((saved) => {
      if (!cancelled && saved) setSent(`Ti abbiamo mandato un codice di ${OTP_LENGTH} cifre.`);
    });
    return () => { cancelled = true; };
  }, [step, token]);

  // Il nome si ritrova anche dopo il ricaricamento del passo del codice.
  useEffect(() => {
    let cancelled = false;
    void recall(token).then((saved) => {
      const field = nameRef.current;
      if (!cancelled && field && saved && !field.value) field.value = saved;
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const value = String(fields.get('name') ?? '').trim();
    const code = String(fields.get('code') ?? '');
    if (!value) {
      setError('Scrivi come vuoi che ti chiamino in redazione.');
      nameRef.current?.focus();
      return;
    }
    setError(null);
    void remember(token, value);
    startTransition(async () => {
      try {
        const result = step === 2
          ? await acceptInviteAction(token, value)
          : sent
            ? await verifyInviteCodeAction(token, value, code)
            : await startInviteLoginAction(token, value);
        if (!result.ok) setError(result.message);
        else if ('redirect' in result) {
          await forget(token);
          await forgetInviteStep(token);
          router.replace(safeNext(result.redirect));
        }
        else {
          setSent(result.message);
          await rememberInviteStep(token);
        }
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      <label htmlFor="invito-nome" className={common.label} style={{ marginTop: 0 }}>
        Come ti chiamano in redazione
      </label>
      <input
        id="invito-nome"
        ref={nameRef}
        name="name"
        type="text"
        required
        maxLength={100}
        autoComplete="name"
        autoCapitalize="words"
        placeholder="Nome e cognome, o come preferisci"
        className={common.field}
        defaultValue=""
        aria-describedby={error ? 'invito-error' : 'invito-nome-hint'}
        aria-invalid={error ? true : undefined}
        disabled={pending}
      />
      <p id="invito-nome-hint" className={common.hint}>
        È il nome che vedranno gli altri accanto a voti e commenti.
      </p>

      <p className={common.label}>La tua email</p>
      <p className={styles.locked}>
        <Icon name="lock" size={15} />
        <span>{email}</span>
      </p>
      <p className={common.hint}>L&apos;ha scelta chi ti ha invitato: non si cambia.</p>

      {sent && step === 1 ? (
        <>
          <p className={styles.sentText} aria-live="polite">{sent}</p>
          <p className={styles.sentText}>Ti abbiamo mandato un codice di {OTP_LENGTH} cifre a <strong>{email}</strong>. Vale 10 minuti, puoi aprire la mail anche dal telefono.</p>
          <label htmlFor="invito-code" className={common.label}>Codice di {OTP_LENGTH} cifre</label>
          <input
            id="invito-code"
            name="code"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_LENGTH}
            className={common.field}
            aria-describedby={error ? 'invito-error' : undefined}
            aria-invalid={error ? true : undefined}
            disabled={pending}
          />
        </>
      ) : null}

      <div className={common.live} aria-live="polite" aria-atomic="true" id="invito-error">
        {error ? (
          <p className={`${common.notice} ${common.noticeErr}`}>
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={pending} aria-busy={pending}>
        {pending ? (step === 1 && !sent ? 'Mando il codice…' : 'Entro…') : step === 1 && !sent ? 'Mandami il codice' : 'Entra in redazione'}
      </button>
      {sent && step === 1 ? (
        <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} disabled={pending} onClick={() => {
          const name = nameRef.current?.value.trim() ?? '';
          if (!name) {
            setError('Scrivi come vuoi che ti chiamino in redazione.');
            nameRef.current?.focus();
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              const result = await startInviteLoginAction(token, name);
              if (!result.ok) setError(result.message);
              else {
                setSent(result.message);
                await rememberInviteStep(token);
              }
            } catch {
              setError(NETWORK_ERROR);
            }
          });
        }}>Rimanda il codice</button>
      ) : null}
    </form>
  );
}
