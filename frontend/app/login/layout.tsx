import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to access your family reunion account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
