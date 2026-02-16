import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Manage reunion settings, users, and content.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
