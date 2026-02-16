import type { Metadata } from 'next';
import { serverFetch, getFamilyLabel } from '../lib/serverFetch';
import NewslettersClient from './NewslettersClient';
import type { NewsletterDto } from '../lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { quarterly } = await getFamilyLabel();
  return {
    title: `${quarterly} — Newsletters`,
    description: `Read past and current issues of the ${quarterly} family newsletter.`,
  };
}

export default async function NewslettersPage() {
  let initialData: NewsletterDto[] | undefined;

  try {
    initialData = await serverFetch<NewsletterDto[]>('/api/newsletters');
  } catch {
    // Client will re-fetch on mount
  }

  return <NewslettersClient initialData={initialData} />;
}
