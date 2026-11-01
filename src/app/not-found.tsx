import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthFrame } from '@/components/auth/AuthFrame';
import common from '@/components/topic/common.module.css';
import styles from '@/components/auth/AuthForm.module.css';

export const metadata: Metadata = { title: 'Non trovato' };

/** Indirizzo che non esiste, o pagina che chi guarda non può vedere: la stessa risposta, senza dire quale dei due. */
export default function NotFound() {
  return (
    <AuthFrame title="Qui non c’è niente" lead="Il link è sbagliato, oppure la pagina è stata spostata.">
      <div className={styles.actions}>
        <Link href="/temi" className={`${common.btn} ${common.sm}`}>
          Torna ai temi
        </Link>
      </div>
    </AuthFrame>
  );
}
