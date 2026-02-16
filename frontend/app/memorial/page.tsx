import type { Metadata } from 'next';
import { getFamilyLabel } from '../lib/serverFetch';
import MemorialClient from './MemorialClient';

export async function generateMetadata(): Promise<Metadata> {
  const { family } = await getFamilyLabel();
  return {
    title: `${family} Image Gallery`,
    description: `Browse and share photos from ${family} gatherings, events, and everyday moments.`,
  };
}

export default async function MemorialPage() {
  const { full } = await getFamilyLabel();

  return <MemorialClient familyName={full} />;
}
