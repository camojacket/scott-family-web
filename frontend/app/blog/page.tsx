import type { Metadata } from 'next';
import type { BlogPost } from '../lib/types';
import { serverFetch } from '../lib/serverFetch';
import BlogClient from './BlogClient';

export const metadata: Metadata = {
  title: 'Family Blog',
  description: 'Stay connected with family news, stories, and updates.',
};

export default async function BlogPage() {
  let initialPosts: BlogPost[] | undefined;
  try {
    initialPosts = await serverFetch<BlogPost[]>('/api/blog-posts?sort=newest');
  } catch {
    // fall back to client-side fetch
  }

  return <BlogClient initialPosts={initialPosts} />;
}
