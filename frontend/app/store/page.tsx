import type { Metadata } from 'next';
import { serverFetch } from '../lib/serverFetch';
import { StorePageLayout } from './StoreClient';
import type { ProductDto } from '../lib/types';

export const metadata: Metadata = {
  title: 'Family Store — Reunion Shirts & Merchandise',
  description: 'Browse and purchase reunion shirts and family merchandise.',
};

export default async function StorePage() {
  let products: ProductDto[] = [];
  let error = '';

  try {
    products = await serverFetch<ProductDto[]>('/api/store/products');
  } catch {
    error = 'Failed to load products';
  }

  return <StorePageLayout products={products} error={error} />;
}
