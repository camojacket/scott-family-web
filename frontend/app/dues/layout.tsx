import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dues & Payments',
  description: 'View and pay your family reunion dues online.',
};

export default function DuesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
