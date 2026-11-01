import { DesktopShell } from '@/components/shell/DesktopShell';
import styles from './loading.module.css';

const ROWS = [78, 62, 90, 55, 70];

/** Scheletro della bacheca: stesse misure delle righe vere, così non salta nulla quando arrivano i dati. */
export default function Loading() {
  return (
    <DesktopShell
      current="temi"
      title="Temi"
      list={
        <div role="status" aria-busy="true">
          <span className="sr-only">Carico i temi…</span>
          <div className={styles.seg} aria-hidden="true" />
          <div className={styles.group} aria-hidden="true" />
          <ul className={styles.list} aria-hidden="true">
            {ROWS.map((width, index) => (
              <li key={index} className={styles.row}>
                <span className={styles.body}>
                  <span className={`${styles.bar} ${styles.line}`} style={{ width: `${width}%` }} />
                  <span className={`${styles.bar} ${styles.meta}`} />
                </span>
                <span className={styles.votes}>
                  <span className={styles.sq} />
                  <span className={styles.sq} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <span />
    </DesktopShell>
  );
}
