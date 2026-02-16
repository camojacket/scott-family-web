import type { Metadata } from 'next';
import { serverFetch, getFamilyLabel } from '../lib/serverFetch';
import ReunionClient from './ReunionClient';
import type { ReunionSettings } from './ReunionClient';

export async function generateMetadata(): Promise<Metadata> {
  const { family } = await getFamilyLabel();
  let number = '';
  try {
    const s = await serverFetch<Record<string, string>>('/api/settings');
    number = s?.reunion_number ? ` #${s.reunion_number}` : '';
  } catch { /* ignore */ }
  return {
    title: `${family} Reunion${number}`,
    description: `RSVP and details for the upcoming ${family} family reunion.`,
  };
}

export default async function ReunionPage() {
  let initialSettings: ReunionSettings | undefined;

  try {
    const s = await serverFetch<Record<string, string>>('/api/settings');
    initialSettings = {
      reunion_number: s?.reunion_number,
      reunion_location: s?.reunion_location,
      reunion_hosted_by: s?.reunion_hosted_by,
      reunion_info_packet_url: s?.reunion_info_packet_url,
    };
  } catch {
    // Client will re-fetch on mount
  }

  return <ReunionClient initialSettings={initialSettings} />;
}
