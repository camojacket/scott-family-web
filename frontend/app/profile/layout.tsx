import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'View and edit your family profile and account settings.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
