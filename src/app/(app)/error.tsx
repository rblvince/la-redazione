'use client';

import { ErrorPanel } from '@/components/shell/ErrorPanel';

/** Rete di sicurezza per In lavoro, Archivio, Persone e Amministrazione: le schermate gestiscono da sé gli errori attesi. */
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorPanel current="none" title="Redazione" retry={retry} />;
}
