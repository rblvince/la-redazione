export function privateAccess(profile: { active: boolean } | null, error: unknown): 'ok' | 'inattivo' | 'errore' {
  if (error != null) return 'errore';
  return profile?.active === true ? 'ok' : 'inattivo';
}
