'use client';

import { useState, useTransition } from 'react';
import { logoutAction } from '@/app/accedi/actions';
import { Icon } from './Icon';
import styles from './LogoutButton.module.css';

const NETWORK_ERROR = 'Non sono riuscito a uscire. Controlla la connessione e riprova.';

type LogoutButtonProps = {
  className: string;
  /** Dove si va dopo l'uscita. Senza, si torna alla pagina di accesso. */
  next?: string;
  label?: string;
  /** Con l'icona di uscita davanti al testo (barra laterale e intestazione). */
  icon?: boolean;
  /** Mostra il motivo del fallimento sotto il tasto. Altrimenti il tasto cambia testo e il motivo lo leggono gli screen reader. */
  showMessage?: boolean;
};

/** "Esci": un tocco, nessuna finestra di conferma. Uscire non distrugge niente, si rientra col link. L'azione decide; qui si mostra l'esito. */
export function LogoutButton({ className, next, label = 'Esci', icon = false, showMessage = false }: LogoutButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function leave() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        // Se riesce, l'azione fa il redirect e questa riga non torna mai.
        const result = await logoutAction(next);
        if (result && !result.ok) setError(result.message);
      } catch {
        setError(NETWORK_ERROR);
      }
    });
  }

  return (
    <>
      <button type="button" className={className} onClick={leave} disabled={pending} aria-busy={pending}>
        {icon ? <Icon name="logout" size={15} /> : null}
        {pending ? 'Esco…' : error && !showMessage ? 'Non riuscito, riprova' : label}
      </button>
      <span role="status" className={showMessage && error ? styles.msg : 'sr-only'}>
        {error}
      </span>
    </>
  );
}
