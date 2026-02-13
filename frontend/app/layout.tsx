import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import './init';
import React from 'react';
import Navigation from './components/Navigation';
import { FamilyNameProvider } from './lib/FamilyNameContext';
import { CartProvider } from './lib/CartContext';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

const SCOTT_ONLY_DOMAINS: string[] = (
  process.env.NEXT_PUBLIC_SCOTT_ONLY_DOMAINS ?? ''
)
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function getFamilyLabel(host: string): string {
  const hostname = host.split(':')[0].toLowerCase();
  return SCOTT_ONLY_DOMAINS.includes(hostname) ? 'Scott' : 'Scott-Phillips';
}

export async function generateMetadata(): Promise<Metadata> {
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const label = getFamilyLabel(host);

  return {
    title: `${label} Family — Strengthening Family Ties`,
    description: `The official website of the ${label} Family, descendants of Sarah Scott and Marcus A. Scott. Stay connected through reunions, history, and family news.`,
    keywords: [label, 'family reunion', 'genealogy', 'family tree', 'Sarah Scott', 'Marcus Scott'],
    openGraph: {
      title: `${label} Family`,
      description: 'Strengthening Family Ties — Reunions, History & Family News',
      type: 'website',
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <FamilyNameProvider>
          <CartProvider>
            <Navigation>{children}</Navigation>
          </CartProvider>
        </FamilyNameProvider>
      </body>
    </html>
  );
}
