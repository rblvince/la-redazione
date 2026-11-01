import type { ReactNode } from 'react';
import { DesktopShell, type ShellProps } from './DesktopShell';
import styles from './ListSkeleton.module.css';

const ROWS = [78, 62, 90, 55];

/** Righe finte con le stesse misure di quelle vere: quando arrivano i dati non salta nulla. */
function Rows({ count = ROWS.length, tall = false }: { count?: number; tall?: boolean }) {
  return (
    <ul className={styles.list} aria-hidden="true">
      {ROWS.slice(0, count).map((width, index) => (
        <li key={index} className={styles.row}>
          <span className={styles.body}>
            <span className={`${styles.bar} ${styles.line}`} style={{ width: `${width}%` }} />
            {tall ? <span className={`${styles.bar} ${styles.line}`} style={{ width: `${width - 25}%` }} /> : null}
            <span className={`${styles.bar} ${styles.meta}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Scheletro delle schermate a elenco (In lavoro, Archivio, Persone). */
export function ListSkeleton({
  current,
  title,
  label,
  search = false,
  groups = 1,
  phoneShows,
}: {
  current: ShellProps['current'];
  title: string;
  label: string;
  search?: boolean;
  groups?: number;
  phoneShows?: ShellProps['phoneShows'];
}) {
  return (
    <DesktopShell
      current={current}
      title={title}
      phoneShows={phoneShows}
      list={
        <div role="status" aria-busy="true">
          <span className="sr-only">{label}</span>
          {search ? <div className={styles.search} aria-hidden="true" /> : null}
          {Array.from({ length: groups }, (_, index) => (
            <div key={index}>
              <div className={styles.group} aria-hidden="true" />
              <Rows count={index === 0 ? 3 : 2} tall={search} />
            </div>
          ))}
        </div>
      }
    >
      <span />
    </DesktopShell>
  );
}

/** Scheletro delle schermate a pannelli (Amministrazione). */
export function PanelSkeleton({ current, title, label, children }: { current: ShellProps['current']; title: string; label: string; children?: ReactNode }) {
  return (
    <DesktopShell current={current} title={title} phoneShows="detail" list={<span />} canPropose={false}>
      <div className={styles.panels} role="status" aria-busy="true">
        <span className="sr-only">{label}</span>
        <div className={styles.heading} aria-hidden="true" />
        {[3, 2, 2].map((rows, index) => (
          <div key={index} aria-hidden="true">
            <div className={styles.group} />
            <Rows count={rows} />
          </div>
        ))}
        {children}
      </div>
    </DesktopShell>
  );
}
