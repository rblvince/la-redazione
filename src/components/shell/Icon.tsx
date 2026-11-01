import type { ReactNode } from 'react';

export type IconName =
  | 'inbox'
  | 'pen'
  | 'arch'
  | 'book'
  | 'plus'
  | 'chev'
  | 'check'
  | 'x'
  | 'ok'
  | 'clock'
  | 'lock'
  | 'link'
  | 'alert'
  | 'user'
  | 'copy'
  | 'logout';

// Un solo tratto per tutte: 24x24, contorno, estremità squadrate (come nel mockup v3).
const SHAPES: Record<IconName, ReactNode> = {
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  arch: (
    <>
      <rect x="2" y="3" width="20" height="5" />
      <path d="M4 8v13h16V8" />
      <path d="M10 12h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chev: <path d="m15 18-6-6 6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  ok: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v5M12 17.5v.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" />
      <path d="M5 15H3V3h12v2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H4V3h5" />
      <path d="m16 16 4-4-4-4M20 12H9" />
    </>
  ),
};

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Se manca, l'icona è decorativa e resta nascosta ai lettori di schermo. */
  title?: string;
  className?: string;
};

export function Icon({ name, size = 20, strokeWidth = 1.8, title, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
