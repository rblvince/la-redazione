import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export type BootstrapResult = { status: 'creato' | 'già presente'; userId: string };

type BootstrapErrorCode =
  | 'INVALID_INPUT'
  | 'PROFILE_CONFLICT'
  | 'PROFILE_READ_FAILED'
  | 'PROFILE_CREATE_FAILED'
  | 'AUTH_LIST_FAILED'
  | 'AUTH_CREATE_FAILED';

class BootstrapError extends Error {
  readonly code: BootstrapErrorCode;

  constructor(code: BootstrapErrorCode) {
    super(code);
    this.code = code;
  }
}

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  displayName: z.string().trim().min(1).max(60),
});

type Profile = { id: string; email: string; role: string };

async function findProfile(admin: SupabaseClient, column: 'email' | 'id', value: string): Promise<Profile | null> {
  const { data, error } = await admin.from('profiles').select('id,email,role').eq(column, value).maybeSingle();
  if (error) throw new BootstrapError('PROFILE_READ_FAILED');
  return data as Profile | null;
}

export async function bootstrapMaintainer(
  admin: SupabaseClient,
  input: { email: string; displayName: string },
): Promise<BootstrapResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new BootstrapError('INVALID_INPUT');
  const { email, displayName } = parsed.data;

  // Check the email first, before creating Auth, so an existing profile cannot leave an orphan account.
  const profileByEmail = await findProfile(admin, 'email', email);
  if (profileByEmail && profileByEmail.role !== 'manutentore') {
    throw new BootstrapError('PROFILE_CONFLICT');
  }

  let userId: string | undefined;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users) throw new BootstrapError('AUTH_LIST_FAILED');
    const user = data.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
    if (user) {
      userId = user.id;
      break;
    }
    if (data.users.length === 0) break;
  }

  if (!userId) {
    if (profileByEmail) throw new BootstrapError('PROFILE_CONFLICT');
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data?.user?.id) throw new BootstrapError('AUTH_CREATE_FAILED');
    userId = data.user.id;
  }

  const profileById = await findProfile(admin, 'id', userId);
  if (profileByEmail && profileByEmail.id !== userId) throw new BootstrapError('PROFILE_CONFLICT');
  if (profileById) {
    if (profileById.email !== email || profileById.role !== 'manutentore') {
      throw new BootstrapError('PROFILE_CONFLICT');
    }
    return { status: 'già presente', userId };
  }

  const { error } = await admin.from('profiles').insert({
    id: userId, email, display_name: displayName, role: 'manutentore',
  });
  if (error) throw new BootstrapError('PROFILE_CREATE_FAILED');
  return { status: 'creato', userId };
}

const cliMessages: Record<BootstrapErrorCode, string> = {
  INVALID_INPUT: 'Argomenti non validi',
  PROFILE_CONFLICT: 'Profilo esistente incompatibile',
  PROFILE_READ_FAILED: 'Lettura profili non riuscita',
  PROFILE_CREATE_FAILED: 'Creazione profilo non riuscita',
  AUTH_LIST_FAILED: 'Ricerca utenti non riuscita',
  AUTH_CREATE_FAILED: 'Creazione utente non riuscita',
};

function parseArgs(args: string[]): { email: string; displayName: string } {
  if (args.length !== 4 || args[0] !== '--email' || args[2] !== '--nome') {
    throw new BootstrapError('INVALID_INPUT');
  }
  return { email: args[1], displayName: args[3] };
}

async function main(): Promise<void> {
  try {
    const input = parseArgs(process.argv.slice(2));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('Configurazione mancante');
      process.exitCode = 1;
      return;
    }
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await bootstrapMaintainer(admin, input);
    console.log(`${result.status} ${result.userId}`);
  } catch (error) {
    console.error(error instanceof BootstrapError ? cliMessages[error.code] : 'Errore inatteso');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
