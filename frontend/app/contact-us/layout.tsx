import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the family reunion committee. Send questions, feedback, or ideas.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
