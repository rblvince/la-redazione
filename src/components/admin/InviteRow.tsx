'use client';

import { revokeInviteAction } from '@/app/(app)/admin/actions';
import { roleLabel } from '@/components/people/roles';
import { Pill } from '@/components/shell/Pill';
import { Notice } from '@/components/topic/Notice';
import { useAction } from '@/components/topic/useAction';
import type { AdminInvite } from '@/lib/queries/admin';
import { outcome } from './adapt';
import { ConfirmAction } from './ConfirmAction';
import styles from './AdminScreen.module.css';

export type InviteStatus = 'attivo' | 'scaduto' | 'usato' | 'revocato';

const STATUS_PILL: Record<InviteStatus, { label: string; tone: 'neutral' | 'gold' | 'on' | 'red' }> = {
  attivo: { label: 'Attivo', tone: 'on' },
  scaduto: { label: 'Scaduto', tone: 'gold' },
  usato: { label: 'Usato', tone: 'neutral' },
  revocato: { label: 'Revocato', tone: 'neutral' },
};

/** Una riga d'invito. Solo gli inviti attivi si possono revocare. `detail` è la data già formattata dal server. */
export function InviteRow({ invite, status, detail }: { invite: AdminInvite; status: InviteStatus; detail: string }) {
  const { pending, notice, run } = useAction();
  const pill = STATUS_PILL[status];
  return (
    <li className={styles.item}>
      <div className={styles.who}>
        <div className={styles.whoText}>
          <p className={styles.name}>{invite.email}</p>
          <p className={styles.email}>
            {roleLabel(invite.role)} · {detail}
          </p>
        </div>
        <div className={styles.tags}>
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
      </div>
      {status === 'attivo' ? (
        <div className={styles.controls}>
          <ConfirmAction
            label="Revoca"
            question={`Revocare l'invito per ${invite.email}? Il link già consegnato smette di funzionare.`}
            yes="Sì, revoca"
            pending={pending}
            onConfirm={() => run(() => outcome(revokeInviteAction(invite.id)), `Invito per ${invite.email} revocato.`)}
          />
        </div>
      ) : null}
      <Notice notice={notice} />
    </li>
  );
}
