import { Icon } from '@/components/shell/Icon';
import styles from './common.module.css';
import type { Notice as NoticeState } from './useAction';

/** Esito di un'azione, annunciato ai lettori di schermo. Il tono non dipende solo dal colore: ha l'icona. */
export function Notice({ notice }: { notice: NoticeState }) {
  return (
    <div className={styles.live} aria-live="polite" aria-atomic="true">
      {notice ? (
        <p className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeErr : styles.noticeOk}`}>
          <Icon name={notice.tone === 'error' ? 'alert' : 'check'} size={16} />
          <span>{notice.text}</span>
        </p>
      ) : null}
    </div>
  );
}
