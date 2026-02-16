import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shopping Cart',
  description: 'Review items in your cart before checkout.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
