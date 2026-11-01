import type { Metadata } from 'next';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Accedi' };

/** Accesso senza password: mostra l'esito dei vecchi link o della verifica del profilo. */
export default async function AccediPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = params.errore === 'link' || params.errore === 'accesso' || params.errore === 'temporaneo'
    ? params.errore : null;
  return (
    <AuthFrame title="Entra in redazione" lead="Scrivi l’email con cui sei stato invitato: ti mandiamo un codice, niente password.">
      <LoginForm error={error} />
    </AuthFrame>
  );
}
