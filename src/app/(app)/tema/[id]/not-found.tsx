import { EmptyState } from '@/components/board/EmptyState';
import { DesktopShell } from '@/components/shell/DesktopShell';

/** Tema che non esiste, o che chi guarda non può vedere: stessa schermata, senza dire quale dei due. */
export default function TemaNotFound() {
  return (
    <DesktopShell current="temi" title="Temi" list={<span />} phoneShows="detail" back={{ href: '/temi', label: 'Temi' }}>
      <EmptyState title="Questo tema non c'è." hint="Può essere stato rimosso, oppure il link è sbagliato." action={{ href: '/temi', label: 'Torna ai temi' }} />
    </DesktopShell>
  );
}
