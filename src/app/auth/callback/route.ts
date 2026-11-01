import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/domain/safe-next';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  let appUrl: URL;
  try {
    appUrl = new URL(process.env.APP_URL ?? '');
    if (!['http:', 'https:'].includes(appUrl.protocol) || !appUrl.hostname) {
      throw new TypeError('APP_URL must be an HTTP(S) URL with a hostname');
    }
  } catch {
    return new NextResponse(null, {
      status: 307,
      headers: { Location: '/accedi?errore=link' },
    });
  }
  const code = request.nextUrl.searchParams.get('code');
  const rawFlowId = request.nextUrl.searchParams.get('sb_flow_id');
  const flowId = rawFlowId && /^[a-zA-Z0-9_-]{8,64}$/.test(rawFlowId) ? rawFlowId : null;
  if (code) {
    try {
      const response = NextResponse.redirect(new URL(next, appUrl));
      const supabase = await createServerSupabaseClient(response);
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error) return response;
      console.error(`[auth/callback] scambio fallito: ${error.code || error.status || 'sconosciuto'}`);
    } catch {
      // The same public error applies to missing configuration and invalid links.
    }
  }
  return NextResponse.redirect(new URL('/accedi?errore=link', appUrl));
}
