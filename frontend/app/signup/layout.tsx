import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a new account to connect with family members.',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
