const ZONE = 'Europe/Rome';
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const dayMonth = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', timeZone: ZONE });

/** "27/10", sempre nel fuso della redazione, così server e browser dicono lo stesso giorno. */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dayMonth.format(date);
}

/** "ora", "12 min fa", "2 h fa", "ieri", "3 gg fa", poi la data. */
export function whenAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now.getTime() - then);
  if (diff < MINUTE) return 'ora';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min fa`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h fa`;
  if (diff < 2 * DAY) return 'ieri';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} gg fa`;
  return shortDate(iso);
}
