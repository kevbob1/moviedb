import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MovieDB',
  description: 'Movie database application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
