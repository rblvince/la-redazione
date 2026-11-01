import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import styles from './TabBar.module.css';

export type NavKey = 'temi' | 'in-lavoro' | 'archivio' | 'manuale';

export const NAV_ITEMS: { key: NavKey; label: string; href: string; icon: IconName }[] = [
  { key: 'temi', label: 'Temi', href: '/temi', icon: 'inbox' },
  { key: 'in-lavoro', label: 'In lavoro', href: '/in-lavoro', icon: 'pen' },
  { key: 'archivio', label: 'Archivio', href: '/archivio', icon: 'arch' },
  { key: 'manuale', label: 'Manuale', href: '/manuale', icon: 'book' },
];

/** Barra in basso del telefono. Nascosta da 1024px, dove la navigazione sta nella barra laterale. */
export function TabBar({ current }: { current: NavKey | null }) {
  return (
    <nav className={styles.tabs} aria-label="Sezioni">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`${styles.tab} ${item.key === current ? styles.on : ''}`}
          aria-current={item.key === current ? 'page' : undefined}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
