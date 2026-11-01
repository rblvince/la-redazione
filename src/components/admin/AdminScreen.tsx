import type { ReactNode } from 'react';
import { EmptyState } from '@/components/board/EmptyState';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { sidebarNames } from '@/components/shell/sidebar';
import common from '@/components/topic/common.module.css';
import { shortDate } from '@/components/topic/time';
import type { AdminInvite, AdminResult } from '@/lib/queries/admin';
import { InviteRow, type InviteStatus } from './InviteRow';
import { PersonRow } from './PersonRow';
import { RulesForm } from './RulesForm';
import styles from './AdminScreen.module.css';

export type AdminView = Exclude<AdminResult, { forbidden: true }>;

function statusOf(invite: AdminInvite, now: Date): InviteStatus {
  if (invite.revoked_at) return 'revocato';
  if (invite.used_at) return 'usato';
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return 'scaduto';
  return 'attivo';
}

function detailOf(invite: AdminInvite, status: InviteStatus): string {
  switch (status) {
    case 'attivo':
      return `scade il ${shortDate(invite.expires_at)}`;
    case 'scaduto':
      return `scaduto il ${shortDate(invite.expires_at)}`;
    case 'usato':
      return `usato il ${shortDate(invite.used_at ?? invite.created_at)}`;
    case 'revocato':
      return `revocato il ${shortDate(invite.revoked_at ?? invite.created_at)}`;
  }
}

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className={common.section} aria-labelledby={`${id}-t`} id={id}>
      <div className={common.head}>
        <h2 className={common.title} id={`${id}-t`}>
          {title}
        </h2>
        {note ? <p className={common.note}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Fold({ title, invites, now, status }: { title: string; invites: AdminInvite[]; now: Date; status: InviteStatus }) {
  if (invites.length === 0) return null;
  return (
    <details className={styles.fold}>
      <summary className={styles.summary}>
        <span>{title}</span>
        <span className={styles.foldCount}>{invites.length}</span>
      </summary>
      <ul className={common.panel}>
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} status={status} detail={detailOf(invite, statusOf(invite, now))} />
        ))}
      </ul>
    </details>
  );
}

/** "Amministrazione": persone e ruoli, inviti, regole. Solo il manutentore ci arriva: il controllo vero sta sul server, in `page.tsx`. */
export function AdminScreen({ result, now }: { result: AdminView; now: Date }) {
  const invites = result.ok ? result.invites : [];
  const byStatus = (status: InviteStatus) => invites.filter((invite) => statusOf(invite, now) === status);
  const active = byStatus('attivo');
  const people = result.ok ? result.people : [];
  return (
    <DesktopShell
      current="admin"
      title="Amministrazione"
      canPropose={false}
      phoneShows="detail"
      back={{ href: '/persone', label: 'Persone' }}
      people={sidebarNames(people)}
      adminHref="/admin"
      list={
        <nav aria-label="In questa pagina" className={styles.toc}>
          <a href="#persone">
            Persone <span>{people.length}</span>
          </a>
          <a href="#inviti">
            Inviti <span>{active.length}</span>
          </a>
          <a href="#regole">Regole</a>
        </nav>
      }
    >
      <div className={styles.pane}>
        <h1 className={styles.heading}>Amministrazione</h1>
        {!result.ok ? (
          <EmptyState tone="error" title="La pagina non si carica." hint={result.message} action={{ href: '/admin', label: 'Riprova' }} />
        ) : (
          <>
            <Block id="persone" title="Persone" note={`${people.length}`}>
              {people.length > 0 ? (
                <ul className={common.panel}>
                  {people.map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))}
                </ul>
              ) : (
                <p className={common.empty}>Nessuno ancora. Invita la prima persona dalla pagina Persone.</p>
              )}
            </Block>

            <Block id="inviti" title="Inviti" note={active.length === 1 ? '1 attivo' : `${active.length} attivi`}>
              {active.length > 0 ? (
                <ul className={common.panel}>
                  {active.map((invite) => (
                    <InviteRow key={invite.id} invite={invite} status="attivo" detail={detailOf(invite, 'attivo')} />
                  ))}
                </ul>
              ) : (
                <p className={common.empty}>Nessun invito in attesa.</p>
              )}
              <Fold title="Scaduti" invites={byStatus('scaduto')} now={now} status="scaduto" />
              <Fold title="Usati" invites={byStatus('usato')} now={now} status="usato" />
              <Fold title="Revocati" invites={byStatus('revocato')} now={now} status="revocato" />
            </Block>

            <Block id="regole" title="Regole">
              <RulesForm settings={result.settings} />
            </Block>
          </>
        )}
      </div>
    </DesktopShell>
  );
}
