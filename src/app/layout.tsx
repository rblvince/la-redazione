import type { Metadata, Viewport } from 'next';
import { Archivo_Black, IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';

// Archivo Black esiste solo nel peso 400: i titoli non chiedono mai un grassetto finto.
const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-archivo' });
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-mono',
});
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'Redazione', template: '%s · Redazione' },
  description: 'Lo spazio privato della redazione: temi, verifica e pubblicazione.',
  applicationName: 'Redazione',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Redazione', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0f130f',
  colorScheme: 'dark',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="it" className={`${archivo.variable} ${plexMono.variable} ${inter.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Salta al contenuto
        </a>
        {children}
      </body>
    </html>
  );
}
