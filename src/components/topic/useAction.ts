'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export type Notice = { tone: 'ok' | 'error'; text: string } | null;
type Outcome = { ok: true } | { ok: false; message: string };

const NETWORK_ERROR = 'Non sono riuscito a completare l’azione. Controlla la connessione e riprova.';

/**
 * Esegue un'azione del server dal browser: tiene lo stato "in corso", prepara l'avviso per l'esito
 * e ricarica i dati della pagina. Non tocca la logica: l'azione decide, qui si mostra soltanto.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);

  function run(task: () => Promise<Outcome>, okText?: string, onDone?: () => void) {
    if (pending) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          setNotice({ tone: 'error', text: result.message });
          return;
        }
        if (okText) setNotice({ tone: 'ok', text: okText });
        onDone?.();
        router.refresh();
      } catch {
        setNotice({ tone: 'error', text: NETWORK_ERROR });
      }
    });
  }

  return { pending, notice, setNotice, run };
}
