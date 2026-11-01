'use client';

import { setActiveAction, setRoleAction } from '@/app/(app)/admin/actions';
import { roleLabel } from '@/components/people/roles';
import { Pill } from '@/components/shell/Pill';
import common from '@/components/topic/common.module.css';
import { Avatar } from '@/components/topic/Person';
import { Notice } from '@/components/topic/Notice';
import { useAction } from '@/components/topic/useAction';
import type { AdminPerson } from '@/lib/queries/admin';
import { outcome } from './adapt';
import { ConfirmAction } from './ConfirmAction';
import styles from './AdminScreen.module.css';

/** Una persona e i suoi comandi: cambiare ruolo, disattivare (con conferma) o riattivare. */
export function PersonRow({ person }: { person: AdminPerson }) {
  const { pending, notice, run } = useAction();
  const other = person.role === 'decisore' ? 'membro' : 'decisore';
  return (
    <li className={styles.item}>
      <div className={styles.who}>
        <Avatar name={person.display_name} />
        <div className={styles.whoText}>
          <p className={styles.name}>{person.display_name}</p>
          {person.email ? <p className={styles.email}>{person.email}</p> : null}
        </div>
        <div className={styles.tags}>
          <Pill>{roleLabel(person.role)}</Pill>
          {person.active ? null : <Pill tone="gold">Non attivo</Pill>}
        </div>
      </div>
      <div className={styles.controls}>
        {person.active ? (
          <>
            <button
              type="button"
              className={`${common.btn} ${common.ghost} ${common.sm}`}
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                run(() => outcome(setRoleAction(person.id, other)), `${person.display_name} ora è ${roleLabel(other).toLowerCase()}.`)
              }
            >
              Passa a {roleLabel(other).toLowerCase()}
            </button>
            <ConfirmAction
              label="Disattiva"
              question={`Disattivare ${person.display_name}? Non potrà più entrare; i suoi voti e commenti restano.`}
              yes="Sì, disattiva"
              pending={pending}
              onConfirm={() => run(() => outcome(setActiveAction(person.id, false)), `Accesso di ${person.display_name} disattivato.`)}
            />
          </>
        ) : (
          <button
            type="button"
            className={`${common.btn} ${common.sm}`}
            disabled={pending}
            aria-busy={pending}
            onClick={() => run(() => outcome(setActiveAction(person.id, true)), `Accesso di ${person.display_name} riattivato.`)}
          >
            Riattiva
          </button>
        )}
      </div>
      <Notice notice={notice} />
    </li>
  );
}
