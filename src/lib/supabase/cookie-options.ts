export function supabaseCookieOptions(appUrl: string | undefined) {
  let secure = false;
  try {
    secure = new URL(appUrl ?? '').protocol === 'https:';
  } catch {
    // Missing or malformed APP_URL keeps local HTTP cookies usable.
  }
  return { sameSite: 'lax' as const, path: '/', ...(secure ? { secure: true } : {}) };
}
