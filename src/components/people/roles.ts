export type RoleKey = 'decisore' | 'membro' | 'manutentore';

const LABEL: Record<RoleKey, string> = { decisore: 'Decisore', membro: 'Membro', manutentore: 'Manutentore' };

export function roleLabel(role: string): string {
  return LABEL[role as RoleKey] ?? role;
}

/** Quello che il ruolo permette, in una riga: si legge accanto alla scelta, non in un tooltip. */
export const ROLE_HINT: Record<'decisore' | 'membro', string> = {
  decisore: 'Vota i temi, decide e può invitare altre persone.',
  membro: 'Propone temi, verifica e commenta. Non vota e non invita.',
};
