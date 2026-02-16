import type { Metadata } from 'next';
import { serverFetch, getFamilyLabel } from '../../lib/serverFetch';
import ObituariesClient from './ObituariesClient';
import type { ObituaryDto } from '../../lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { family } = await getFamilyLabel();
  return {
    title: `Obituaries — ${family}`,
    description: `Memorial obituaries for ${family} members.`,
  };
}

export default async function ObituariesPage() {
  let initialData: ObituaryDto[] | undefined;

  try {
    initialData = await serverFetch<ObituaryDto[]>('/api/obituaries');
  } catch {
    // Client will re-fetch on mount
  }

  return <ObituariesClient initialData={initialData} />;
}
