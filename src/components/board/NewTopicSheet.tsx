'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent, type MouseEvent, type SyntheticEvent } from 'react';
import { proposeAction, proposeFormAction } from '@/app/(app)/temi/actions';
import { Icon } from '@/components/shell/Icon';
import { FORMATS } from './formats';
import styles from './NewTopicSheet.module.css';

const TITLE_MAX = 280;
const NETWORK_ERROR = 'Non sono riuscito a salvare il tema. Controlla la connessione e riprova.';

type NewTopicSheetProps = {
  /** Dove si torna chiudendo: la bacheca, con la stessa vista di prima. */
  closeHref: string;
};

/**
 * "Nuovo tema". Telefono: pannello che sale dal basso. Da 1024px: finestra al centro.
 * Si monta quando l'indirizzo ha `?nuovo=1`, quindi il link profondo arriva già aperto dal server (anche senza JS:
 * l'`open` è nel markup). Con JS diventa un `<dialog>` modale vero: focus intrappolato, resto della pagina inerte, Esc.
 */
export function NewTopicSheet({ closeHref }: NewTopicSheetProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [clientError, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Percorso senza JavaScript: il modulo parte come invio normale verso l'azione del server. Con JS `onSubmit` lo ferma
  // e resta il comportamento di prima (nessun ricaricamento, pannello che si chiude da solo).
  const [formState, formAction] = useActionState(proposeFormAction, { ok: true, id: '' });
  const error = clientError ?? (!formState.ok ? formState.message : null);
  const [dirty, setDirty] = useState(false);
  const closing = useRef(false);

  function close() {
    if (closing.current) return;
    closing.current = true;
    router.push(closeHref);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Dal markup "aperto" del server al modale vero.
    if (dialog.open) dialog.close();
    dialog.showModal();
    titleRef.current?.focus();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousOverflow;
      // close() rimette il focus su ciò che aveva aperto il pannello (il +).
      if (dialog.open) dialog.close();
    };
  }, []);

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc: chiudiamo noi, così l'indirizzo e la bacheca restano coerenti.
    event.preventDefault();
    if (!pending) close();
  }

  function onBackdrop(event: MouseEvent<HTMLDialogElement>) {
    // Il tocco fuori dal pannello chiude solo se non c'è niente da perdere.
    if (event.target === event.currentTarget && !dirty && !pending) close();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '').trim();
    const link = String(data.get('link') ?? '').trim();
    if (!title) {
      setError('Scrivi il tema: bastano due righe.');
      titleRef.current?.focus();
      return;
    }
    if (link && !/^https:\/\/\S+$/i.test(link)) {
      setError('Il link deve iniziare con https://');
      (event.currentTarget.elements.namedItem('link') as HTMLInputElement | null)?.focus();
      return;
    }
    data.set('title', title);
    data.set('link', link);
    if (format) data.set('format', format);
    else data.delete('format');
    setError(null);
    startTransition(async () => {
      try {
        const result = await proposeAction(data);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        closing.current = true;
        router.replace(closeHref);
        router.refresh();
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <>
      {/* Senza JS è l'unica ombra dietro il pannello e chiude con un tocco; con JS il dialogo modale sta sopra. */}
      <Link href={closeHref} className={styles.scrim} aria-hidden="true" tabIndex={-1} />
      <dialog
        ref={dialogRef}
        open
        className={styles.sheet}
        aria-modal="true"
        aria-labelledby="nuovo-tema-titolo"
        onClick={onBackdrop}
        onCancel={onCancel}
      >
        <form className={styles.form} action={formAction} onSubmit={onSubmit} noValidate aria-busy={pending}>
          <input type="hidden" name="format" value={format ?? ''} />
          <div className={styles.head}>
            <h2 id="nuovo-tema-titolo" className={styles.heading}>
              Nuovo tema
            </h2>
            <Link href={closeHref} className={styles.close}>
              <Icon name="x" size={18} />
              <span className="sr-only">Chiudi</span>
            </Link>
          </div>

          <label className={styles.label} htmlFor="nuovo-tema-testo">
            Il tema
          </label>
          <textarea
            ref={titleRef}
            id="nuovo-tema-testo"
            name="title"
            className={styles.field}
            rows={4}
            maxLength={TITLE_MAX}
            required
            autoFocus
            autoComplete="off"
            placeholder="Cosa vuoi portare? Anche solo una frase."
            disabled={pending}
            onChange={(e) => setDirty(e.target.value.trim().length > 0)}
            aria-describedby={error ? 'nuovo-tema-errore' : undefined}
          />

          <label className={styles.label} htmlFor="nuovo-tema-link">
            Link <span className={styles.opt}>facoltativo</span>
          </label>
          <input
            id="nuovo-tema-link"
            name="link"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`${styles.field} ${styles.input}`}
            placeholder="https://"
            disabled={pending}
          />

          <fieldset className={styles.formats} disabled={pending}>
            <legend className={styles.label}>
              Formato <span className={styles.opt}>facoltativo</span>
            </legend>
            <div className={styles.chips}>
              {FORMATS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`${styles.chip} ${format === item.value ? styles.chipOn : ''}`}
                  aria-pressed={format === item.value}
                  onClick={() => setFormat(format === item.value ? null : item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          {error ? (
            <p id="nuovo-tema-errore" className={styles.error} role="alert">
              <Icon name="alert" size={16} />
              {error}
            </p>
          ) : null}

          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Salvo…' : 'Butta dentro'}
          </button>
          <p className={styles.note}>L&apos;anteprima del link arriva dopo, senza farti aspettare.</p>
        </form>
      </dialog>
    </>
  );
}
