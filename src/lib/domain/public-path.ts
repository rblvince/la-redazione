export function isPublicPath(pathname: string): boolean {
  return pathname === '/accedi'
    || pathname === '/invito'
    || pathname.startsWith('/invito/')
    || pathname === '/auth/callback'
    || pathname === '/manifest.webmanifest'
    || pathname === '/icon.svg'
    || pathname === '/apple-icon.png'
    || pathname === '/robots.txt'
    || pathname.startsWith('/icons/');
}
