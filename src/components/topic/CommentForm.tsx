'use client';

import { useId, useState, type FormEvent } from 'react';
import { commentAction } from '@/app/(app)/temi/actions';
import { Notice } from './Notice';
import { useAction } from './useAction';
import styles from './common.module.css';
import form from './CommentForm.module.css';

const MAX = 4000;

export function CommentForm({ topicId }: { topicId: string }) {
  const id = useId();
  const [text, setText] = useState('');
  const { pending, notice, setNotice, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body) {
      setNotice({ tone: 'error', text: 'Scrivi qualcosa prima di inviare.' });
      return;
    }
    run(() => commentAction(topicId, body), undefined, () => setText(''));
  }

  return (
    <form className={form.form} onSubmit={submit} noValidate aria-busy={pending}>
      <label htmlFor={`${id}-testo`} className="sr-only">
        Il tuo commento
      </label>
      <textarea
        id={`${id}-testo`}
        className={`${styles.field} ${form.area}`}
        rows={3}
        maxLength={MAX}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Scrivi un commento"
        disabled={pending}
        autoComplete="off"
      />
      <div className={form.row}>
        <button type="submit" className={`${styles.btn} ${styles.ghost} ${styles.sm}`} disabled={pending} aria-busy={pending}>
          {pending ? 'Invio…' : 'Commenta'}
        </button>
      </div>
      <Notice notice={notice} />
    </form>
  );
}
