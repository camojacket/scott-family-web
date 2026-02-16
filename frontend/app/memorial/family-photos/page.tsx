import type { Metadata } from 'next';
import type { GalleryImage } from '../../lib/types';
import { serverFetch } from '../../lib/serverFetch';
import FamilyPhotosClient from './FamilyPhotosClient';

export const metadata: Metadata = {
  title: 'Family Photos',
  description: 'Browse and share family photos, memories, and video highlights.',
};

export default async function FamilyPhotosPage() {
  let initialImages: GalleryImage[] | undefined;
  try {
    initialImages = await serverFetch<GalleryImage[]>('/api/gallery/images');
  } catch {
    // fall back to client-side fetch
  }

  return <FamilyPhotosClient initialImages={initialImages} />;
}
