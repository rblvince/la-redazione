import { DesktopShell } from '@/components/shell/DesktopShell';
import styles from './loading.module.css';

/** Scheletro del tema: titolo, barra delle fasi e un pannello di proprietà, con le misure delle parti vere. */
export default function Loading() {
  return (
    <DesktopShell current="temi" title="Temi" list={<span />} phoneShows="detail" back={{ href: '/temi', label: 'Temi' }}>
      <div className={styles.wrap} role="status" aria-busy="true">
        <span className="sr-only">Carico il tema…</span>
        <div aria-hidden="true">
          <span className={`${styles.bar} ${styles.title}`} />
          <span className={`${styles.bar} ${styles.title2}`} />
          <ul className={styles.ticks}>
            {[0, 1, 2, 3, 4].map((tick) => (
              <li key={tick} className={styles.tick} />
            ))}
          </ul>
          <div className={styles.panel}>
            {[70, 45, 82].map((width) => (
              <div key={width} className={styles.row}>
                <span className={`${styles.bar} ${styles.key}`} />
                <span className={`${styles.bar} ${styles.val}`} style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
          <span className={`${styles.bar} ${styles.head}`} />
          <div className={styles.panel}>
            {[88, 60].map((width) => (
              <div key={width} className={styles.row}>
                <span className={`${styles.bar} ${styles.val}`} style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}
