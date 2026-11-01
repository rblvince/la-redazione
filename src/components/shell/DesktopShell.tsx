import Link from 'next/link';
import type { ReactNode } from 'react';
import { Fab } from './Fab';
import { Icon } from './Icon';
import { LogoutButton } from './LogoutButton';
import { NAV_ITEMS, TabBar, type NavKey } from './TabBar';
import styles from './DesktopShell.module.css';

export type ShellProps = {
  /** La sezione della barra; `persone` e `admin` stanno fuori dalla barra in basso e la lasciano tutta spenta. */
  current: NavKey | 'persone' | 'admin' | 'none';
  /** Titolo dell'elenco: su telefono è il titolo della pagina, da 1024px l'intestazione della colonna centrale. */
  title: string;
  /** La colonna dell'elenco (voci, intestazioni di gruppo, stati vuoto e caricamento). */
  list: ReactNode;
  /** Il tema aperto o la scheda aperta. Porta il suo `h1`. */
  children: ReactNode;
  /** Su telefono vede una cosa alla volta: l'elenco oppure il dettaglio. */
  phoneShows?: 'list' | 'detail';
  /** Link "indietro" del telefono quando si vede il dettaglio. */
  back?: { href: string; label: string };
  counts?: Partial<Record<NavKey, number>>;
  /** Voci sotto "Strumenti". Se vuoto la sezione non compare. */
  tools?: { label: string; href: string }[];
  /** Nomi sotto "Persone". Se vuoto la sezione non compare. */
  people?: string[];
  /** Se presente compare "Invita persona" (solo chi può invitare). */
  inviteHref?: string;
  /** Se presente compare "Amministrazione" (solo manutentore). */
  adminHref?: string;
  /** Dove porta "Nuovo tema": il pannello vive sulla bacheca (`/temi?nuovo=1`), non su una rotta sua. */
  newTopicHref?: string;
  /** Il tasto "+" sul telefono copre il fondo del dettaglio (spunte, barra di azioni): lì si nasconde. */
  hideFab?: boolean;
  /** Chi non può proporre (il manutentore, in sola lettura) non vede "Nuovo tema" né il tasto "+". */
  canPropose?: boolean;
};

export function DesktopShell({
  current,
  title,
  list,
  children,
  phoneShows = 'list',
  back,
  counts = {},
  tools = [],
  people = [],
  inviteHref,
  adminHref,
  newTopicHref = '/temi?nuovo=1',
  hideFab = false,
  canPropose = true,
}: ShellProps) {
  const listOnPhone = phoneShows === 'list';
  const showFab = canPropose && !hideFab;
  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="Redazione">
        <p className={styles.brand}>
          Redazione<span>.</span>
        </p>
        {canPropose ? (
          <Link href={newTopicHref} className={styles.newTopic}>
            <Icon name="plus" size={15} strokeWidth={2.6} />
            Nuovo tema
          </Link>
        ) : null}
        <nav aria-label="Sezioni">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.nav} ${item.key === current ? styles.navOn : ''}`}
              aria-current={item.key === current ? 'page' : undefined}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
              {counts[item.key] !== undefined && <span className={styles.count}>{counts[item.key]}</span>}
            </Link>
          ))}
        </nav>
        {tools.length > 0 && (
          <>
            <p className={styles.sep}>Strumenti</p>
            <nav aria-label="Strumenti">
              {tools.map((tool) => (
                <Link key={tool.label} href={tool.href} className={styles.nav}>
                  {tool.label}
                </Link>
              ))}
            </nav>
          </>
        )}
        <Link
          href="/persone"
          className={`${styles.sep} ${styles.sepLink} ${current === 'persone' ? styles.sepOn : ''}`}
          aria-current={current === 'persone' ? 'page' : undefined}
        >
          Persone
        </Link>
        {people.length > 0 && (
          <ul className={styles.people}>
            {people.map((name) => (
              <li key={name} className={styles.nav}>
                <span className={styles.avatar} aria-hidden="true">
                  {name.trim().charAt(0).toUpperCase()}
                </span>
                {name}
              </li>
            ))}
          </ul>
        )}
        {adminHref && (
          <Link
            href={adminHref}
            className={`${styles.nav} ${current === 'admin' ? styles.navOn : ''}`}
            aria-current={current === 'admin' ? 'page' : undefined}
          >
            <Icon name="lock" size={15} />
            Amministrazione
          </Link>
        )}
        {inviteHref && (
          <Link href={inviteHref} className={`${styles.nav} ${styles.invite}`}>
            <Icon name="plus" size={15} />
            Invita persona
          </Link>
        )}
        <div className={styles.exit}>
          <LogoutButton className={styles.exitBtn} icon />
        </div>
      </aside>

      <main id="main" className={`${styles.main} ${showFab ? '' : styles.noFab}`}>
        <div className={`${styles.mid} ${listOnPhone ? '' : styles.phoneHidden}`}>
          <header className={styles.top}>
            <h1>{title}</h1>
            <Link href="/persone" className={styles.topLink} aria-current={current === 'persone' ? 'page' : undefined}>
              <Icon name="user" size={15} />
              Persone
            </Link>
            <LogoutButton className={styles.topLink} icon />
          </header>
          <p className={styles.hd}>{title}</p>
          {list}
        </div>
        <div className={`${styles.det} ${listOnPhone ? styles.phoneHidden : ''}`}>
          {back && !listOnPhone && (
            <Link href={back.href} className={styles.back}>
              <Icon name="chev" size={15} />
              {back.label}
            </Link>
          )}
          {children}
        </div>
      </main>

      <TabBar current={current === 'persone' || current === 'admin' || current === 'none' ? null : current} />
      {showFab ? <Fab href={newTopicHref} /> : null}
    </div>
  );
}
