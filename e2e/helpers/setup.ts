import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TestUser = { id: string; email: string; name: string; role: 'decisore' | 'membro' };
export type TestEnvironment = {
  appUrl: string;
  supabaseUrl: string;
  anonKey: string;
  admin: SupabaseClient;
};

export function loadEnvironment(): TestEnvironment {
  const required = [
    'APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] as const;
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Variabile ambiente obbligatoria mancante: ${key}`);
  }

  const appUrl = process.env.APP_URL!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    appUrl,
    supabaseUrl,
    anonKey,
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export function createRunUsers(timestamp: number): { prefix: string; users: Record<'marco' | 'giulia' | 'membro', TestUser> } {
  const prefix = `e2e-${timestamp}`;
  return {
    prefix,
    users: {
      marco: { id: '', email: `${prefix}-marco@example.com`, name: 'Marco', role: 'decisore' },
      giulia: { id: '', email: `${prefix}-giulia@example.com`, name: 'Giulia', role: 'decisore' },
      membro: { id: '', email: `${prefix}-membro@example.com`, name: 'Membro E2E', role: 'membro' },
    },
  };
}

export async function createDecider(admin: SupabaseClient, user: TestUser): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({ email: user.email, email_confirm: true });
  if (error || !data.user) throw new Error(`Creazione utente di prova non riuscita (${user.role}).`);
  const created = { ...user, id: data.user.id };
  const { error: profileError } = await admin.from('profiles').insert({
    id: created.id,
    email: created.email,
    display_name: created.name,
    role: created.role,
  });
  if (profileError) throw new Error(`Creazione profilo di prova non riuscita (${user.role}).`);
  return created;
}

export async function createInvitedMember(admin: SupabaseClient, user: TestUser): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({ email: user.email, email_confirm: true });
  if (error || !data.user) throw new Error('Creazione utente Auth per l’invito non riuscita.');
  return { ...user, id: data.user.id };
}
