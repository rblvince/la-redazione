'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { addSourceAction } from '@/app/(app)/tema/[id]/actions';
import { safeHref } from '@/lib/domain/url';
import { runWithScreenshotCleanup, uploadSourceScreenshot, validateSourceScreenshot } from '@/lib/upload/source-screenshot';
import { Notice } from './Notice';
import { useAction } from './useAction';
import common from './common.module.css';
import styles from './SourceForm.module.css';

const TITLE_MAX = 280;

export function SourceForm({ topicId }: { topicId: string }) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [kind, setKind] = useState<'primaria' | 'secondaria'>('primaria');
  const [busy, setBusy] = useState(false);
  const { pending, notice, setNotice, run } = useAction();
  const working = pending || busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '').trim();
    const url = String(data.get('url') ?? '').trim();
    const file = data.get('screenshot');
    if (!title) return setNotice({ tone: 'error', text: 'Dai un titolo alla fonte.' });
    if (!safeHref(url)) return setNotice({ tone: 'error', text: 'Il link deve iniziare con https:// ed essere un sito vero.' });

    let path: string | null = null;
    if (file instanceof File && file.size > 0) {
      const check = validateSourceScreenshot(topicId, file);
      if (!check.ok) return setNotice({ tone: 'error', text: check.message });
      setBusy(true);
      setNotice(null);
      try {
        const uploaded = await uploadSourceScreenshot(topicId, file);
        if (!uploaded.ok) return setNotice({ tone: 'error', text: uploaded.message });
        path = uploaded.path;
      } catch {
        return setNotice({ tone: 'error', text: 'Non sono riuscito a caricare lo screenshot. Riprova.' });
      } finally {
        setBusy(false);
      }
    }

    run(() => runWithScreenshotCleanup(path, () => addSourceAction(topicId, title, url, kind, path)), 'Fonte aggiunta.', () => {
      formRef.current?.reset();
      setKind('primaria');
    });
  }

  return (
    <details ref={detailsRef} className={styles.details}>
      <summary className={styles.summary}>
        <span aria-hidden="true">+</span> Aggiungi fonte
      </summary>
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-busy={working}>
        <label className={common.label} htmlFor={`${id}-titolo`}>
          Titolo
        </label>
        <input
          id={`${id}-titolo`}
          name="title"
          type="text"
          className={common.field}
          maxLength={TITLE_MAX}
          autoComplete="off"
          placeholder="Es. Comunicato ufficiale della società"
          disabled={working}
        />

        <label className={common.label} htmlFor={`${id}-link`}>
          Link
        </label>
        <input
          id={`${id}-link`}
          name="url"
          type="url"
          inputMode="url"
          className={`${common.field} ${common.mono}`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://"
          disabled={working}
        />

        <fieldset className={styles.kinds} disabled={working}>
          <legend className={common.label}>Tipo</legend>
          <div className={styles.radios}>
            {(['primaria', 'secondaria'] as const).map((value) => (
              <label key={value} className={`${styles.radio} ${kind === value ? styles.radioOn : ''}`}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                  className="sr-only"
                />
                {value === 'primaria' ? 'Primaria' : 'Secondaria'}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={common.label} htmlFor={`${id}-shot`}>
          Screenshot <span className={common.opt}>facoltativo</span>
        </label>
        <input
          id={`${id}-shot`}
          name="screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.file}
          disabled={working}
        />
        <p className={common.hint}>Salva la pagina com&apos;è oggi: i link spariscono.</p>

        <button type="submit" className={`${common.btn} ${styles.submit}`} disabled={working} aria-busy={working}>
          {busy ? 'Carico lo screenshot…' : pending ? 'Salvo…' : 'Aggiungi fonte'}
        </button>
        <Notice notice={notice} />
      </form>
    </details>
  );
}
