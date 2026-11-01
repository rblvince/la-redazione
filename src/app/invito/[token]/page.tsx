import type { Metadata } from 'next';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { InviteFlow } from '@/components/auth/InviteFlow';
import { InviteProblem } from '@/components/auth/InviteProblem';
import { errorMessage } from '@/lib/domain/errors';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { peekInviteAction } from './actions';

export const metadata: Metadata = { title: 'Invito' };

/** Chi è già entrato può riscattare l'invito senza richiedere un altro codice. */
async function sessionEmail(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/**
 * L'invito si completa sulla stessa pagina. Fuori dal guscio: chi arriva qui non è ancora in redazione.
 * L'email viene dall'invito e non si cambia; il token dell'indirizzo non si mostra mai.
 */
export default async function InvitoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, email] = await Promise.all([peekInviteAction(token), sessionEmail()]);

  if (!invite.ok) {
    return (
      <AuthFrame
        title={invite.status === 'errore' ? 'Non riesco a controllare l’invito' : 'Questo invito non si può usare'}
      >
        <InviteProblem
          message={invite.message}
          retryHref={invite.status === 'errore' ? `/invito/${encodeURIComponent(token)}` : undefined}
          signedIn={email !== null}
        />
      </AuthFrame>
    );
  }

  if (email !== null && email !== invite.email) {
    return (
      <AuthFrame title="Questo invito è per un’altra email">
        <InviteProblem message={errorMessage('email_diversa')} signedIn reopenToken={token} />
      </AuthFrame>
    );
  }

  const step = email === null ? 1 : 2;
  return (
    <AuthFrame
      title={step === 1 ? 'Ti hanno invitato in redazione' : 'Ultimo passo'}
      lead={
        step === 1
          ? 'Dicci come ti chiami: poi ti mandiamo un codice per entrare. Niente password.'
          : 'Sei dentro con questa email. Conferma il tuo nome e arrivi ai temi.'
      }
    >
      <InviteFlow token={token} email={invite.email} step={step} />
    </AuthFrame>
  );
}
