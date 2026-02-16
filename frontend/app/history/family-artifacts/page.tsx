import type { Metadata } from 'next';
import type { FamilyArtifactDto } from '../../lib/types';
import { serverFetch } from '../../lib/serverFetch';
import FamilyArtifactsClient from './FamilyArtifactsClient';

export const metadata: Metadata = {
  title: 'Family Artifacts',
  description: 'Historical documents, photos, and records from the family archives.',
};

export default async function FamilyArtifactsPage() {
  let initialData: FamilyArtifactDto[] | undefined;
  try {
    initialData = await serverFetch<FamilyArtifactDto[]>('/api/family-artifacts');
  } catch {
    // fall back to client-side fetch
  }

  return <FamilyArtifactsClient initialData={initialData} />;
}
