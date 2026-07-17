import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { Navigation } from './components/Navigation';
import { SwipeNavigation } from './components/SwipeNavigation';
import { PageTransition } from '@/components/motion/PageTransition';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are on Jellyfin and request new ones',
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans bg-background text-foreground antialiased">
        <Header />
        <PageTransition>
          <main>
            <SwipeNavigation>{children}</SwipeNavigation>
          </main>
        </PageTransition>
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-foreground hover:opacity-80 transition-opacity"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          Jellyfin
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
