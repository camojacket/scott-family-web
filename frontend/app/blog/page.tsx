'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';

const TinyMCEEditor = dynamic(() => import('./TinyMCEEditor'), { ssr: false });

interface BlogPost {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export default function BlogPage({ userRole }: { userRole: string }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  useEffect(() => {
    fetch('/api/blog-posts')
      .then(res => res.json())
      .then(setPosts);
  }, []);

  async function handleSubmit() {
    await fetch('/api/blog-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: contentHtml }),
    });
    setOpen(false);
    setTitle('');
    setContentHtml('');
    const res = await fetch('/api/blog-posts');
    setPosts(await res.json());
  }

  return (
    <div className="p-6">
      <Typography variant="h4" className="mb-6">SCOTT'S FAMILY BLOG</Typography>
      {/*userRole === 'ROLE_ADMIN' */true && (
        <Button variant="contained" onClick={() => setOpen(true)} className="mb-4">
          Create New Blog Post
        </Button>
      )}

      {posts.map(post => (
        <Card key={post.id} className="mb-6">
          <CardContent>
            <Typography variant="h5">{post.title}</Typography>
            <Typography variant="body2" color="textSecondary">
              {new Date(post.createdAt).toLocaleString()}
            </Typography>
            <div
              className="mt-3 prose max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Blog Post</DialogTitle>
        <DialogContent>
          <input
            className="w-full border p-2 rounded mb-4"
            placeholder="Post Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <TinyMCEEditor value={contentHtml} onChange={setContentHtml} />
          <div className="mt-4 text-right">
            <Button onClick={handleSubmit} variant="contained" color="primary">
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
