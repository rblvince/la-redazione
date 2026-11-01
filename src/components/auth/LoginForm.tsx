'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, verifyLoginCodeAction } from '@/app/accedi/actions';
import { Icon } from '@/components/shell/Icon';
import common from '@/components/topic/common.module.css';
import { forgetLoginStep, recallLoginStep, rememberLoginStep } from '@/lib/domain/code-step';
import { OTP_LENGTH } from '@/lib/domain/otp';
import styles from './AuthForm.module.css';

const NETWORK_ERROR = 'Non sono riuscito a mandare la richiesta. Controlla la connessione e riprova.';

/** L'email apre il secondo passo; il codice resta solo nel campo e nella richiesta al server. */
export function LoginForm({ error = null }: { error?: 'link' | 'accesso' | 'temporaneo' | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      const saved = recallLoginStep();
      if (!cancelled && saved) setEmail(saved);
    });
    return () => { cancelled = true; };
  }, []);

  function sendCode(address: string) {
    setFormError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await loginAction(address);
        if (!result.ok) setFormError(result.message);
        else {
          const savedEmail = address.trim();
          setEmail(savedEmail);
          rememberLoginStep(savedEmail);
          setNotice(result.message);
        }
      } catch {
        setFormError(NETWORK_ERROR);
      }
    });
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    sendCode(String(new FormData(event.currentTarget).get('email') ?? ''));
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !email) return;
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await verifyLoginCodeAction(email, code);
        if (!result.ok) setFormError(result.message);
        else {
          forgetLoginStep();
          router.replace(result.redirect);
        }
      } catch {
        setFormError(NETWORK_ERROR);
      }
    });
  }

  return (
    <>
      {error ? (
        <p className={styles.alert} role="alert">
          <Icon name="alert" size={18} />
          <span>{error === 'accesso'
            ? 'Sei entrato, ma il tuo invito non risulta accettato. Apri il link d’invito che hai ricevuto: ti fa entrare subito.'
            : error === 'temporaneo'
              ? 'Non siamo riusciti a verificare il tuo accesso. Riprova tra poco.'
              : 'Quel link non funziona più: ora si entra con un codice. Scrivi la tua email qui sotto.'}</span>
        </p>
      ) : null}
      {email ? (
        <form onSubmit={submitCode} className={styles.form}>
          <p className={styles.sentText}>Ti abbiamo mandato un codice di {OTP_LENGTH} cifre a <strong>{email}</strong>. Vale 10 minuti, puoi aprire la mail anche dal telefono.</p>
          {notice ? <p className={styles.sentText} aria-live="polite">{notice}</p> : null}
          <label htmlFor="accedi-code" className={common.label}>Codice di {OTP_LENGTH} cifre</label>
          <input
            id="accedi-code"
            name="code"
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_LENGTH}
            className={common.field}
            aria-describedby={formError ? 'accedi-error' : undefined}
            aria-invalid={formError ? true : undefined}
            disabled={pending}
          />
          <div className={common.live} aria-live="polite" aria-atomic="true" id="accedi-error">
            {formError ? <p className={`${common.notice} ${common.noticeErr}`}><Icon name="alert" size={16} /><span>{formError}</span></p> : null}
          </div>
          <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={pending} aria-busy={pending}>
            {pending ? 'Entro…' : 'Entra'}
          </button>
          <div className={styles.actions}>
            <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} disabled={pending} onClick={() => sendCode(email)}>
              Rimanda il codice
            </button>
            <button type="button" className={`${common.btn} ${common.ghost} ${common.sm}`} disabled={pending} onClick={() => {
              forgetLoginStep();
              setEmail(null);
              setFormError(null);
              setNotice(null);
              requestAnimationFrame(() => emailRef.current?.focus());
            }}>
              Cambia email
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitEmail} className={styles.form}>
          <label htmlFor="accedi-email" className={common.label} style={{ marginTop: 0 }}>La tua email</label>
          <input
            id="accedi-email"
            ref={emailRef}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nome@esempio.it"
            className={common.field}
            aria-describedby={formError ? 'accedi-error' : undefined}
            aria-invalid={formError ? true : undefined}
            disabled={pending}
          />
          <div className={common.live} aria-live="polite" aria-atomic="true" id="accedi-error">
            {formError ? <p className={`${common.notice} ${common.noticeErr}`}><Icon name="alert" size={16} /><span>{formError}</span></p> : null}
          </div>
          <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={pending} aria-busy={pending}>
            {pending ? 'Mando il codice…' : 'Mandami il codice'}
          </button>
        </form>
      )}
    </>
  );
}
