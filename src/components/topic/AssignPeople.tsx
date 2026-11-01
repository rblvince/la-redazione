'use client';

import { useId, useState, type FormEvent } from 'react';
import { assignPeopleAction } from '@/app/(app)/tema/[id]/actions';
import { Person } from './Person';
import { Notice } from './Notice';
import { useAction } from './useAction';
import common from './common.module.css';
import styles from './AssignPeople.module.css';

type Candidate = { id: string; display_name: string };

type Props = {
  topicId: string;
  /** Persone attive che possono scrivere o rileggere (non il manutentore). */
  candidates: Candidate[];
  writerId: string | null;
  reviewerId: string | null;
  /** Solo i decisori cambiano le assegnazioni. */
  canEdit: boolean;
  meId: string;
};

export function AssignPeople({ topicId, candidates, writerId, reviewerId, canEdit, meId }: Props) {
  const id = useId();
  const [writer, setWriter] = useState(writerId ?? '');
  const [reviewer, setReviewer] = useState(reviewerId ?? '');
  const { pending, notice, setNotice, run } = useAction();
  const nameOf = (value: string | null) => candidates.find((c) => c.id === value)?.display_name ?? null;

  if (!canEdit) {
    const w = nameOf(writerId);
    const r = nameOf(reviewerId);
    return (
      <dl className={styles.read}>
        <div>
          <dt>Scrive</dt>
          <dd>{w ? <Person name={w} me={writerId === meId} /> : <span className={styles.none}>Da assegnare</span>}</dd>
        </div>
        <div>
          <dt>Rilegge</dt>
          <dd>{r ? <Person name={r} me={reviewerId === meId} /> : <span className={styles.none}>Da assegnare</span>}</dd>
        </div>
      </dl>
    );
  }

  const same = writer !== '' && writer === reviewer;
  const unchanged = writer === (writerId ?? '') && reviewer === (reviewerId ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!writer || !reviewer) {
      setNotice({ tone: 'error', text: 'Scegli chi scrive e chi rilegge.' });
      return;
    }
    if (writer === reviewer) {
      setNotice({ tone: 'error', text: 'Chi scrive non può rileggersi: scegli due persone diverse.' });
      return;
    }
    run(() => assignPeopleAction(topicId, writer, reviewer), 'Assegnazione salvata.');
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-busy={pending}>
      <div className={styles.pair}>
        <div>
          <label className={common.label} htmlFor={`${id}-scrive`}>
            Scrive
          </label>
          <select
            id={`${id}-scrive`}
            className={common.field}
            value={writer}
            onChange={(event) => setWriter(event.target.value)}
            disabled={pending}
            aria-invalid={same}
            aria-describedby={same ? `${id}-uguali` : undefined}
          >
            <option value="">Scegli…</option>
            {candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={common.label} htmlFor={`${id}-rilegge`}>
            Rilegge
          </label>
          <select
            id={`${id}-rilegge`}
            className={common.field}
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            disabled={pending}
            aria-invalid={same}
            aria-describedby={same ? `${id}-uguali` : undefined}
          >
            <option value="">Scegli…</option>
            {candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {same ? (
        <p id={`${id}-uguali`} className={styles.same}>
          Chi scrive non può rileggersi: scegli due persone diverse.
        </p>
      ) : null}
      <button
        type="submit"
        className={`${common.btn} ${common.ghost} ${common.sm} ${styles.save}`}
        disabled={pending || unchanged}
        aria-busy={pending}
      >
        {pending ? 'Salvo…' : writerId && reviewerId ? 'Cambia assegnazione' : 'Assegna'}
      </button>
      <Notice notice={notice} />
    </form>
  );
}
