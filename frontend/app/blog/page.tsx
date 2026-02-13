'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Alert,
  Box,
  Stack,
  Divider,
  TextField,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import SortIcon from '@mui/icons-material/Sort';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NextLink from 'next/link';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import { sanitizeHtml } from '../lib/sanitize';
import type { BlogPost, CommentDto, ProfileDto } from '../lib/types';

const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });

type PostSort = 'newest' | 'oldest' | 'popular';
type CommentSort = 'oldest' | 'newest' | 'popular';

export default function BlogPage() {
  const { family, full } = useFamilyName();

  // ── User state ──
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentPersonId, setCurrentPersonId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Post state ──
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postSort, setPostSort] = useState<PostSort>('newest');

  // ── Create-post dialog ──
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Comments state (per post) ──
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, CommentDto[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [commentSort, setCommentSort] = useState<Record<number, CommentSort>>({});
  const [commentLoading, setCommentLoading] = useState<Record<number, boolean>>({});

  // ── Load current user from localStorage ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p: ProfileDto = JSON.parse(raw);
        setCurrentUserId(p.id);
        setCurrentPersonId(p.personId ?? null);
        const role = p.userRole;
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load posts ──
  const loadPosts = useCallback(async (sort?: PostSort) => {
    try {
      setLoading(true);
      setError(null);
      const s = sort ?? postSort;
      const data = await apiFetch<BlogPost[]>(`/api/blog-posts?sort=${s}`);
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [postSort]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── Load comments for a post ──
  const loadComments = useCallback(async (postId: number, sort?: CommentSort) => {
    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const s = sort ?? commentSort[postId] ?? 'oldest';
      const data = await apiFetch<CommentDto[]>(
        `/api/blog-posts/${postId}/comments?sort=${s}`
      );
      setComments(prev => ({ ...prev, [postId]: data }));
    } catch { /* silent */ }
    setCommentLoading(prev => ({ ...prev, [postId]: false }));
  }, [commentSort]);

  // ── Create post ──
  async function handleSubmit() {
    try {
      setSubmitting(true);
      await apiFetch('/api/blog-posts', {
        method: 'POST',
        body: { title, content: contentHtml },
      });
      setOpen(false);
      setTitle('');
      setContentHtml('');
      await loadPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete post ──
  async function handleDeletePost(postId: number) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/blog-posts/${postId}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete post');
    }
  }

  // ── Toggle post like ──
  async function handleTogglePostLike(postId: number) {
    try {
      const res = await apiFetch<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number }>(
        `/api/blog-posts/${postId}/like`,
        { method: 'POST' }
      );
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, likedByMe: res.liked, dislikedByMe: res.disliked, likeCount: res.likeCount, dislikeCount: res.dislikeCount }
            : p
        )
      );
    } catch { /* silent */ }
  }

  // ── Toggle post dislike ──
  async function handleTogglePostDislike(postId: number) {
    try {
      const res = await apiFetch<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number }>(
        `/api/blog-posts/${postId}/dislike`,
        { method: 'POST' }
      );
      setPosts(prev =>
        prev.map(p =>
          p.id === postId
            ? { ...p, likedByMe: res.liked, dislikedByMe: res.disliked, likeCount: res.likeCount, dislikeCount: res.dislikeCount }
            : p
        )
      );
    } catch { /* silent */ }
  }

  // ── Toggle expand comments ──
  function toggleComments(postId: number) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      if (!comments[postId]) loadComments(postId);
    }
  }

  // ── Create comment ──
  async function handleAddComment(postId: number) {
    const text = commentText[postId]?.trim();
    if (!text) return;
    try {
      await apiFetch(`/api/blog-posts/${postId}/comments`, {
        method: 'POST',
        body: { content: text },
      });
      setCommentText(prev => ({ ...prev, [postId]: '' }));
      await loadComments(postId);
      // Update comment count in post list
      setPosts(prev =>
        prev.map(p =>
          p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add comment');
    }
  }

  // ── Delete comment ──
  async function handleDeleteComment(postId: number, commentId: number) {
    if (!confirm('Delete this comment?')) return;
    try {
      await apiFetch(`/api/blog-posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId),
      }));
      setPosts(prev =>
        prev.map(p =>
          p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  }

  // ── Toggle comment like ──
  async function handleToggleCommentLike(postId: number, commentId: number) {
    try {
      const res = await apiFetch<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number }>(
        `/api/blog-posts/${postId}/comments/${commentId}/like`,
        { method: 'POST' }
      );
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map(c =>
          c.id === commentId
            ? { ...c, likedByMe: res.liked, dislikedByMe: res.disliked, likeCount: res.likeCount, dislikeCount: res.dislikeCount }
            : c
        ),
      }));
    } catch { /* silent */ }
  }

  // ── Toggle comment dislike ──
  async function handleToggleCommentDislike(postId: number, commentId: number) {
    try {
      const res = await apiFetch<{ liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number }>(
        `/api/blog-posts/${postId}/comments/${commentId}/dislike`,
        { method: 'POST' }
      );
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] ?? []).map(c =>
          c.id === commentId
            ? { ...c, likedByMe: res.liked, dislikedByMe: res.disliked, likeCount: res.likeCount, dislikeCount: res.dislikeCount }
            : c
        ),
      }));
    } catch { /* silent */ }
  }

  // ── Change post sort ──
  function handlePostSortChange(_: unknown, val: PostSort | null) {
    if (!val) return;
    setPostSort(val);
    loadPosts(val);
  }

  // ── Change comment sort ──
  function handleCommentSortChange(postId: number, val: CommentSort) {
    setCommentSort(prev => ({ ...prev, [postId]: val }));
    loadComments(postId, val);
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* ── Page header ── */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 800, color: 'var(--foreground)' }}
          >
            Family Blog
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'var(--text-secondary)', mt: 0.5 }}
          >
            Stories, updates, and memories from the {full} family
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{
            bgcolor: 'var(--color-primary-500)',
            '&:hover': { bgcolor: 'var(--color-primary-600)' },
            flexShrink: 0,
          }}
        >
          New Post
        </Button>
      </Stack>

      {/* ── Post sort controls ── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <SortIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Sort:
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={postSort}
          onChange={handlePostSortChange}
        >
          <ToggleButton value="newest">Newest</ToggleButton>
          <ToggleButton value="oldest">Oldest</ToggleButton>
          <ToggleButton value="popular">Popular</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'var(--color-primary-500)' }} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button size="small" onClick={() => loadPosts()} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      )}

      {/* ── Post list ── */}
      <Stack spacing={3}>
        {posts.map(post => {
          const isExpanded = expandedPostId === post.id;
          const postComments = comments[post.id] ?? [];
          const canDelete =
            isAdmin || (currentUserId != null && post.authorId === currentUserId);

          return (
            <Box key={post.id} className="card" sx={{ p: { xs: 3, sm: 4 } }}>
              {/* Title + delete */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, color: 'var(--foreground)', mb: 0.5 }}
                >
                  {post.title}
                </Typography>
                {canDelete && (
                  <Tooltip title="Delete post">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeletePost(post.id)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              {/* Meta */}
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <CalendarTodayIcon
                  sx={{ fontSize: 14, color: 'var(--text-secondary)' }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: 'var(--text-secondary)' }}
                >
                  {new Date(post.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
                {post.authorName && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    &middot;{' '}
                    {post.authorPersonId ? (
                      <NextLink
                        href={currentPersonId && post.authorPersonId === currentPersonId ? '/profile' : `/profile/${post.authorPersonId}`}
                        style={{ color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {post.authorName}
                      </NextLink>
                    ) : (
                      post.authorName
                    )}
                  </Typography>
                )}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {/* Content */}
              <Box
                className="prose max-w-none"
                sx={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
              />

              {/* ── Actions bar ── */}
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ mt: 2, pt: 1.5, borderTop: '1px solid var(--border-color, #e0e0e0)' }}
              >
                {/* Like button */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleTogglePostLike(post.id)}
                >
                  {post.likedByMe ? (
                    <ThumbUpIcon
                      sx={{ fontSize: 20, color: 'var(--color-primary-500)' }}
                    />
                  ) : (
                    <ThumbUpOutlinedIcon
                      sx={{ fontSize: 20, color: 'var(--text-secondary)' }}
                    />
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      color: post.likedByMe
                        ? 'var(--color-primary-500)'
                        : 'var(--text-secondary)',
                      fontWeight: post.likedByMe ? 600 : 400,
                    }}
                  >
                    {post.likeCount}
                  </Typography>
                </Stack>

                {/* Dislike button */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleTogglePostDislike(post.id)}
                >
                  {post.dislikedByMe ? (
                    <ThumbDownIcon
                      sx={{ fontSize: 20, color: '#e53935' }}
                    />
                  ) : (
                    <ThumbDownOutlinedIcon
                      sx={{ fontSize: 20, color: 'var(--text-secondary)' }}
                    />
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      color: post.dislikedByMe ? '#e53935' : 'var(--text-secondary)',
                      fontWeight: post.dislikedByMe ? 600 : 400,
                    }}
                  >
                    {post.dislikeCount}
                  </Typography>
                </Stack>

                {/* Comments toggle */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => toggleComments(post.id)}
                >
                  <ChatBubbleOutlineIcon
                    sx={{ fontSize: 20, color: 'var(--text-secondary)' }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    {post.commentCount}
                  </Typography>
                  {isExpanded ? (
                    <ExpandLessIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                  )}
                </Stack>
              </Stack>

              {/* ── Comments section ── */}
              <Collapse in={isExpanded} timeout="auto">
                <Box sx={{ mt: 2 }}>
                  {/* Comment sort */}
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: 'var(--text-secondary)' }}
                    >
                      Sort comments:
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={commentSort[post.id] ?? 'oldest'}
                      onChange={(_, v) =>
                        v && handleCommentSortChange(post.id, v)
                      }
                    >
                      <ToggleButton value="oldest">Oldest</ToggleButton>
                      <ToggleButton value="newest">Newest</ToggleButton>
                      <ToggleButton value="popular">Popular</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>

                  {commentLoading[post.id] && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}

                  {/* Comment list */}
                  <Stack spacing={1.5}>
                    {postComments.map(c => {
                      const canDeleteComment =
                        isAdmin ||
                        (currentUserId != null && c.authorId === currentUserId);
                      return (
                        <Box
                          key={c.id}
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            bgcolor: 'var(--card-bg-secondary, #f5f5f5)',
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                          >
                            <Box sx={{ flex: 1 }}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {c.authorPersonId ? (
                                    <NextLink
                                      href={currentPersonId && c.authorPersonId === currentPersonId ? '/profile' : `/profile/${c.authorPersonId}`}
                                      style={{ color: 'var(--color-primary-600)', textDecoration: 'none' }}
                                    >
                                      {c.authorName}
                                    </NextLink>
                                  ) : (
                                    c.authorName
                                  )}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'var(--text-secondary)' }}
                                >
                                  {new Date(c.createdAt).toLocaleDateString(
                                    'en-US',
                                    {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    }
                                  )}
                                </Typography>
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{
                                  mt: 0.5,
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {c.content}
                              </Typography>
                            </Box>
                            {canDeleteComment && (
                              <Tooltip title="Delete comment">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    handleDeleteComment(post.id, c.id)
                                  }
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>

                          {/* Comment like */}
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1.5}
                            sx={{ mt: 1 }}
                          >
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.5}
                              sx={{ cursor: 'pointer' }}
                              onClick={() =>
                                handleToggleCommentLike(post.id, c.id)
                              }
                            >
                              {c.likedByMe ? (
                                <ThumbUpIcon
                                  sx={{
                                    fontSize: 16,
                                    color: 'var(--color-primary-500)',
                                  }}
                                />
                              ) : (
                                <ThumbUpOutlinedIcon
                                  sx={{
                                    fontSize: 16,
                                    color: 'var(--text-secondary)',
                                  }}
                                />
                              )}
                              <Typography
                                variant="caption"
                                sx={{
                                  color: c.likedByMe
                                    ? 'var(--color-primary-500)'
                                    : 'var(--text-secondary)',
                                  fontWeight: c.likedByMe ? 600 : 400,
                                }}
                              >
                                {c.likeCount}
                              </Typography>
                            </Stack>

                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={0.5}
                              sx={{ cursor: 'pointer' }}
                              onClick={() =>
                                handleToggleCommentDislike(post.id, c.id)
                              }
                            >
                              {c.dislikedByMe ? (
                                <ThumbDownIcon
                                  sx={{ fontSize: 16, color: '#e53935' }}
                                />
                              ) : (
                                <ThumbDownOutlinedIcon
                                  sx={{
                                    fontSize: 16,
                                    color: 'var(--text-secondary)',
                                  }}
                                />
                              )}
                              <Typography
                                variant="caption"
                                sx={{
                                  color: c.dislikedByMe
                                    ? '#e53935'
                                    : 'var(--text-secondary)',
                                  fontWeight: c.dislikedByMe ? 600 : 400,
                                }}
                              >
                                {c.dislikeCount}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>

                  {/* Add comment input */}
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Write a comment..."
                      value={commentText[post.id] ?? ''}
                      onChange={e =>
                        setCommentText(prev => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => handleAddComment(post.id)}
                      disabled={!(commentText[post.id]?.trim())}
                    >
                      <SendIcon />
                    </IconButton>
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>

      {!loading && posts.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ color: 'var(--text-secondary)' }}>
            No blog posts yet. Be the first to share!
          </Typography>
        </Box>
      )}

      {/* ── Create post dialog ── */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}
        >
          Create New Blog Post
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Post Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TiptapEditor value={contentHtml} onChange={setContentHtml} />
          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button
              onClick={() => setOpen(false)}
              sx={{ mr: 1.5, color: 'var(--text-secondary)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting || !title.trim()}
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
              }}
            >
              {submitting ? 'Submitting...' : 'Publish'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
