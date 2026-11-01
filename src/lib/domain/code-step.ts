const LOGIN_KEY = 'redazione:codice-accesso';
const INVITE_KEY = 'redazione:codice-invito';

/** Il passo dell'invito usa il prefisso e i primi 8 caratteri dell'hash SHA-256 del token. */
async function inviteStorageKey(token: string): Promise<string | null> {
  try {
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hex = Array.from(new Uint8Array(digest).slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${INVITE_KEY}:${hex}`;
  } catch {
    return null;
  }
}

export function rememberLoginStep(email: string) {
  try {
    window.sessionStorage.setItem(LOGIN_KEY, JSON.stringify({ step: 'code', email }));
  } catch {
    // Lo storage può essere disabilitato: il flusso resta disponibile nella pagina corrente.
  }
}

export function recallLoginStep(): string | null {
  try {
    const saved = window.sessionStorage.getItem(LOGIN_KEY);
    if (!saved) return null;
    const value: unknown = JSON.parse(saved);
    if (typeof value === 'object' && value !== null && 'step' in value && value.step === 'code'
      && 'email' in value && typeof value.email === 'string' && value.email.length > 0) return value.email;
  } catch {
    // Una voce non valida o uno storage bloccato riapre il primo passo.
  }
  return null;
}

export function forgetLoginStep() {
  try {
    window.sessionStorage.removeItem(LOGIN_KEY);
  } catch {
    // La navigazione può proseguire anche se lo storage è bloccato.
  }
}

export async function rememberInviteStep(token: string) {
  try {
    const key = await inviteStorageKey(token);
    if (key) window.sessionStorage.setItem(key, JSON.stringify({ step: 'code' }));
  } catch {
    // La pagina corrente conserva comunque il passo.
  }
}

export async function recallInviteStep(token: string): Promise<boolean> {
  try {
    const key = await inviteStorageKey(token);
    if (!key) return false;
    const saved = window.sessionStorage.getItem(key);
    if (!saved) return false;
    const value: unknown = JSON.parse(saved);
    return typeof value === 'object' && value !== null && 'step' in value && value.step === 'code';
  } catch {
    return false;
  }
}

export async function forgetInviteStep(token: string) {
  try {
    const key = await inviteStorageKey(token);
    if (key) window.sessionStorage.removeItem(key);
  } catch {
    // Lo storage bloccato non impedisce il riscatto.
  }
}
