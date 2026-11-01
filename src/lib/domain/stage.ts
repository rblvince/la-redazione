export type Stage = 'da_decidere' | 'verifica' | 'legale' | 'pubblicato' | 'parcheggiato';

export const STAGES = ['da_decidere', 'verifica', 'legale', 'pubblicato', 'parcheggiato'] as const satisfies readonly Stage[];
