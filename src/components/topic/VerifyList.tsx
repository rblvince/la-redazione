'use client';

import { toggleCheckAction } from '@/app/(app)/tema/[id]/actions';
import { CHECK_LABELS } from '@/lib/domain/gate-view';
import { Notice } from './Notice';
import { useAction } from './useAction';
import { whenAgo } from './time';
import { personName, type PeopleById, type TopicData } from './types';
import styles from './VerifyList.module.css';

export const VERIFY_STEPS = ['isolare', 'fonte_primaria', 'lettura_intera', 'secondo_riscontro', 'controllo_legale'] as const;
export const LEGAL_ITEMS = ['diffamazione', 'continenza', 'gdpr_minori', 'copyright', 'rettifica'] as const;

type Props = {
  topicId: string;
  kind: 'verifica' | 'legale';
  checks: TopicData['checks'];
  people: PeopleById;
  /** false = sola lettura (manutentore). */
  canEdit: boolean;
  now: Date;
};

export function VerifyList({ topicId, kind, checks, people, canEdit, now }: Props) {
  const { pending, notice, run } = useAction();
  const items = kind === 'verifica' ? VERIFY_STEPS : LEGAL_ITEMS;
  const done = new Map(checks.filter((check) => check.kind === kind).map((check) => [check.item, check]));
  const count = items.filter((item) => done.has(item)).length;

  return (
    <div aria-busy={pending}>
      <ul className={styles.list} aria-label={kind === 'verifica' ? 'Passi della verifica' : 'Controllo legale'}>
        {items.map((item) => {
          const check = done.get(item);
          const label = CHECK_LABELS[item];
          return (
            <li key={item} className={styles.item}>
              <label className={`${styles.row} ${canEdit ? '' : styles.static}`}>
                <input
                  type="checkbox"
                  className={styles.box}
                  checked={Boolean(check)}
                  disabled={!canEdit || pending}
                  onChange={(event) => run(() => toggleCheckAction(topicId, kind, item, event.target.checked))}
                />
                <span className={styles.text}>
                  <span className={styles.label}>{label}</span>
                  {check ? (
                    <span className={styles.who}>
                      {personName(people, check.done_by)} · {whenAgo(check.done_at, now)}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className={styles.count} role="status">
        {count} di {items.length} fatti
      </p>
      <div className={styles.notice}>
        <Notice notice={notice} />
      </div>
    </div>
  );
}
