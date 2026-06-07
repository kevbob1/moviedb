import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { Navigation } from './components/Navigation';

export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are on Jellyfin and request new ones',
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 py-6 flex items-center">
            <div className="flex-1" />
            <Link
              href="/"
              className="text-3xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
            >
              Is It On Jellyfin?
            </Link>
            <Navigation />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
