import Link from 'next/link';
import { Icon } from './Icon';
import styles from './Fab.module.css';

/** Tasto + sempre visibile sul telefono: porta a "Nuovo tema". Da 1024px il comando sta nella barra laterale. */
export function Fab({ href, label = 'Nuovo tema' }: { href: string; label?: string }) {
  return (
    <Link href={href} className={styles.fab} aria-label={label}>
      <Icon name="plus" size={24} strokeWidth={2.6} />
    </Link>
  );
}
