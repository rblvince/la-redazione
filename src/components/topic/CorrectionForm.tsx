'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { addCorrectionAction } from '@/app/(app)/tema/[id]/actions';
import { safeHref } from '@/lib/domain/url';
import { Notice } from './Notice';
import { useAction } from './useAction';
import common from './common.module.css';
import styles from './CorrectionForm.module.css';

const MAX = 4000;

export function CorrectionForm({ topicId }: { topicId: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const { pending, notice, setNotice, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = String(data.get('body') ?? '').trim();
    const reason = String(data.get('reason') ?? '').trim();
    const link = String(data.get('link') ?? '').trim();
    if (!body) return setNotice({ tone: 'error', text: 'Scrivi che cosa correggi.' });
    if (!reason) return setNotice({ tone: 'error', text: 'Scrivi perché correggi.' });
    if (link && !safeHref(link)) return setNotice({ tone: 'error', text: 'Il nuovo link deve iniziare con https:// ed essere un sito vero.' });
    run(() => addCorrectionAction(topicId, body, reason, link || null), 'Rettifica aggiunta.', () => {
      formRef.current?.reset();
      setOpen(false);
    });
  }

  return (
    <details className={styles.details} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.summary}>
        <span aria-hidden="true">+</span> Aggiungi rettifica
      </summary>
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
        <label className={common.label} htmlFor={`${id}-body`}>
          Che cosa correggi
        </label>
        <textarea id={`${id}-body`} name="body" className={common.field} rows={3} maxLength={MAX} disabled={pending} />

        <label className={common.label} htmlFor={`${id}-reason`}>
          Perché
        </label>
        <textarea id={`${id}-reason`} name="reason" className={common.field} rows={2} maxLength={MAX} disabled={pending} />

        <label className={common.label} htmlFor={`${id}-link`}>
          Nuovo link del post <span className={common.opt}>facoltativo</span>
        </label>
        <input
          id={`${id}-link`}
          name="link"
          type="url"
          inputMode="url"
          className={`${common.field} ${common.mono}`}
          placeholder="https://"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={pending}
        />
        <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={pending} aria-busy={pending}>
          {pending ? 'Salvo…' : 'Aggiungi rettifica'}
        </button>
        <Notice notice={notice} />
      </form>
    </details>
  );
}
