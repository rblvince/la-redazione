import Link from 'next/link';
import { Icon } from '@/components/shell/Icon';
import { LogoutButton } from '@/components/shell/LogoutButton';
import common from '@/components/topic/common.module.css';
import styles from './AuthForm.module.css';

/** Invito che non si può usare: scaduto, già usato, revocato, sbagliato, oppure non riesco a controllarlo. */
export function InviteProblem({
  message,
  retryHref,
  signedIn,
  reopenToken,
}: {
  message: string;
  retryHref?: string;
  signedIn: boolean;
  /** Se c'è, si offre "Esci e riapri l'invito": serve a chi è dentro con un'altra email. */
  reopenToken?: string;
}) {
  return (
    <div>
      <p className={styles.alert} role="alert">
        <Icon name="alert" size={18} />
        <span>{message}</span>
      </p>
      {retryHref ? (
        <div className={styles.actions}>
          <Link href={retryHref} className={`${common.btn} ${common.ghost} ${common.sm}`}>
            Riprova
          </Link>
        </div>
      ) : null}
      {reopenToken ? (
        <div className={styles.reopen}>
          <LogoutButton
            className={`${common.btn} ${styles.submit}`}
            next={`/invito/${encodeURIComponent(reopenToken)}`}
            label="Esci e riapri l’invito"
            showMessage
          />
        </div>
      ) : null}
      <p className={styles.links}>
        {signedIn ? (
          <Link href="/">Vai alla redazione</Link>
        ) : (
          <>
            Hai già un account? <Link href="/accedi">Accedi</Link>
          </>
        )}
      </p>
    </div>
  );
}
