import Link from 'next/link';
import { EmptyState } from '@/components/board/EmptyState';
import { GroupHeader } from '@/components/board/GroupHeader';
import { DesktopShell } from '@/components/shell/DesktopShell';
import { IdlePane } from '@/components/shell/IdlePane';
import { Pill } from '@/components/shell/Pill';
import { sidebarNames } from '@/components/shell/sidebar';
import { Avatar } from '@/components/topic/Person';
import common from '@/components/topic/common.module.css';
import type { PeopleResult } from '@/lib/queries/people';
import { InviteForm } from './InviteForm';
import { roleLabel } from './roles';
import styles from './PeopleScreen.module.css';

const ROLE_ORDER: Record<string, number> = { decisore: 0, membro: 1 };

/** Il manutentore non si mostra mai: non è una persona della redazione. Le persone disattivate nemmeno. */
function visible(result: Extract<PeopleResult, { ok: true }>) {
  return result.people
    .filter((person) => person.active && (person.role as string) !== 'manutentore')
    .sort(
      (a, b) =>
        (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.display_name.localeCompare(b.display_name, 'it'),
    );
}

/** "Persone": chi c'è in redazione. Chi può invitare vede anche il modulo; `invita` lo apre su telefono. */
export function PeopleScreen({
  result,
  invita,
  initialLink,
}: {
  result: PeopleResult;
  invita: boolean;
  initialLink?: { url: string; email: string };
}) {
  const people = result.ok ? visible(result) : [];
  const canInvite = result.ok && result.canInvite;
  const isMaintainer = result.ok && result.me.role === 'manutentore';
  const showForm = canInvite && invita;
  return (
    <DesktopShell
      current="persone"
      title="Persone"
      canPropose={!isMaintainer}
      people={result.ok ? sidebarNames(result.people) : []}
      inviteHref={canInvite ? '/persone?invita=1' : undefined}
      adminHref={isMaintainer ? '/admin' : undefined}
      phoneShows={showForm ? 'detail' : 'list'}
      back={showForm ? { href: '/persone', label: 'Persone' } : undefined}
      list={
        !result.ok ? (
          <EmptyState tone="error" title="L'elenco non si carica." hint={result.message} action={{ href: '/persone', label: 'Riprova' }} />
        ) : (
          <>
            <section>
              <GroupHeader title="In redazione" count={people.length} />
              {people.length > 0 ? (
                <ul className={styles.list}>
                  {people.map((person) => (
                    <li key={person.id} className={styles.row}>
                      <Avatar name={person.display_name} me={person.id === result.me.id} />
                      <span className={styles.name}>{person.display_name}</span>
                      {person.id === result.me.id ? <span className={styles.you}>sei tu</span> : null}
                      <Pill>{roleLabel(person.role)}</Pill>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={common.empty}>Ancora nessuno oltre a chi gestisce l&apos;app.</p>
              )}
            </section>
            {canInvite ? (
              <p className={styles.inviteLink}>
                <Link href="/persone?invita=1" className={`${common.btn} ${common.ghost} ${common.sm}`}>
                  + Invita persona
                </Link>
              </p>
            ) : null}
            {isMaintainer ? (
              <p className={styles.inviteLink}>
                <Link href="/admin" className={`${common.btn} ${common.ghost} ${common.sm}`}>
                  Amministrazione
                </Link>
              </p>
            ) : null}
          </>
        )
      }
    >
      {canInvite ? (
        <div className={styles.pane}>
          <h1 className={styles.heading}>Invita una persona</h1>
          <p className={styles.lead}>Scegli il ruolo, ottieni un link e consegnalo a chi vuoi far entrare.</p>
          <InviteForm initialLink={initialLink} />
        </div>
      ) : (
        <IdlePane title="Chi invita" hint="Gli inviti li fanno i decisori. Se serve una persona in più, chiedilo a uno di loro." />
      )}
    </DesktopShell>
  );
}
