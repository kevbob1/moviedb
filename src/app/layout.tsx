import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are on Jellyfin and request new ones',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MovieDB',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <header className="border-b border-gray-200 dark:border-gray-800">
            <div className="container mx-auto px-4 py-6 flex items-center">
              <div className="flex-1" />
              <Link
                href="/"
                className="text-3xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
              >
                Is It On Jellyfin?
              </Link>
              <div className="flex-1 flex justify-end items-center gap-4">
                <ThemeToggle />
                <Link
                  href="/requests"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  View Requests
                </Link>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
