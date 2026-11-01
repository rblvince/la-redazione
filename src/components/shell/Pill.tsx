import type { ReactNode } from 'react';
import styles from './Pill.module.css';

type PillProps = {
  children: ReactNode;
  /** `on` = scelta attiva (riempita di acido). `gold` e `red` accompagnano sempre un testo. */
  tone?: 'neutral' | 'on' | 'gold' | 'red';
  className?: string;
};

export function Pill({ children, tone = 'neutral', className }: PillProps) {
  return <span className={[styles.pill, styles[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}
