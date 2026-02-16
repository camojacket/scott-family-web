import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Family Tree',
  description: 'Explore the family tree and discover family connections across generations.',
};

export default function FamilyTreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
