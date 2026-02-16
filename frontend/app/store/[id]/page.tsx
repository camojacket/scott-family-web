import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serverFetch } from '../../lib/serverFetch';
import ProductDetailClient from './ProductDetailClient';
import type { ProductDto } from '../../lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await serverFetch<ProductDto>(`/api/store/products/${id}`);
    return {
      title: `${product.name} — Family Store`,
      description: product.description || `${product.name} available in the family store.`,
    };
  } catch {
    return { title: 'Product Not Found' };
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  let product: ProductDto | null = null;

  try {
    product = await serverFetch<ProductDto>(`/api/store/products/${id}`);
  } catch {
    notFound();
  }

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
