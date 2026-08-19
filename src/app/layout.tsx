import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { ThemeScript } from '@/components/theme-script';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
});

export const metadata: Metadata = {
  title: {
    default: 'Life Game OS — Build a life worth winning',
    template: '%s · Life Game OS',
  },
  description:
    'A personal strategy operating system. Design a game plan for your career, health, relationships and future — without sacrificing what makes winning worthwhile.',
  applicationName: 'Life Game OS',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5EF' },
    { media: '(prefers-color-scheme: dark)', color: '#0D1B2A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.variable} ${fraunces.variable}`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-[var(--shadow-lift)]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
