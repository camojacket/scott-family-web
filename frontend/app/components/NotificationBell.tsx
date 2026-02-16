'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { apiFetch } from '../lib/api';

// ─── Types ───────────────────────────────────────────────

type NotificationItem = {
  replyId: number;
  inquiryId: number;
  adminDisplayName: string;
  bodyPreview: string;
  createdAt: string;
  read: boolean;
};

type ReplyItem = {
  id: number;
  senderType: 'ADMIN' | 'USER';
  senderUserId: number;
  senderDisplayName: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type InquiryDetail = {
  id: number;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
  read: boolean;
  status: string;
  userId: number | null;
  replies: ReplyItem[];
};

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Thread overlay ────────────────────────────────
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadDetail, setThreadDetail] = useState<InquiryDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // Fail silently — user might not be logged in
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications();
  };

  const handleClose = () => setAnchorEl(null);

  const openThread = async (notif: NotificationItem) => {
    handleClose();
    setThreadOpen(true);
    setThreadLoading(true);
    setReplyText('');
    try {
      // Mark ALL unread admin replies in this thread as read (clears badge fully)
      await apiFetch(`/api/inquiries/${notif.inquiryId}/read-all`, { method: 'POST' });
      // Fetch the full thread
      const res = await apiFetch<InquiryDetail>(`/api/inquiries/${notif.inquiryId}`);
      setThreadDetail(res);
      fetchNotifications(); // Refresh unread count
    } catch {
      setThreadOpen(false);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!threadDetail || !replyText.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/inquiries/${threadDetail.id}/reply`, {
        method: 'POST',
        body: { body: replyText },
      });
      // Refresh thread
      const res = await apiFetch<InquiryDetail>(`/api/inquiries/${threadDetail.id}`);
      setThreadDetail(res);
      setReplyText('');
    } catch {
      // handle error silently
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Bell icon */}
      <Tooltip title="Messages" arrow>
        <IconButton onClick={handleOpen} size="small" sx={{ color: 'var(--color-gray-700)' }}>
          <Badge
            badgeContent={unreadCount}
            color="error"
            variant={unreadCount > 0 ? 'standard' : 'dot'}
            invisible={unreadCount === 0}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: 10,
                minWidth: 16,
                height: 16,
              },
            }}
          >
            <ChatBubbleOutlineIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notification dropdown */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 360,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Messages</Typography>
          <Typography variant="caption" color="text.secondary">
            Replies from admins to your inquiries
          </Typography>
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No messages yet</Typography>
          </Box>
        ) : (
          notifications.map(notif => (
            <MenuItem
              key={notif.replyId}
              onClick={() => openThread(notif)}
              sx={{
                py: 1.5,
                px: 2,
                borderLeft: notif.read ? 'none' : '3px solid var(--color-primary-500, #1976d2)',
                bgcolor: notif.read ? 'transparent' : 'var(--color-primary-50, #e3f2fd)',
                whiteSpace: 'normal',
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: notif.read ? 400 : 700, fontSize: 13 }}>
                    {notif.adminDisplayName}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                  {notif.bodyPreview}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* ─── Thread Overlay ────────────────────────────── */}
      <Dialog
        open={threadOpen}
        onClose={() => setThreadOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 'var(--radius-lg, 12px)',
            maxHeight: '85vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Conversation</Typography>
          <IconButton onClick={() => setThreadOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {threadLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : threadDetail ? (
            <Box>
              {/* Info bar */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'var(--color-primary-50, #f0f7ff)', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Inquiry submitted on {new Date(threadDetail.submittedAt).toLocaleDateString()}.
                  Messages older than 60 days are automatically deleted.
                </Typography>
              </Box>

              {/* Chat thread */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3, maxHeight: 350, overflowY: 'auto', p: 1 }}>
                {/* Original message */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{
                    maxWidth: '75%',
                    bgcolor: 'var(--color-primary-50, #e3f2fd)',
                    borderRadius: '12px 12px 4px 12px',
                    p: 2,
                    border: '1px solid var(--color-primary-200, #90caf9)',
                  }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      You (original message)
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                      {threadDetail.message}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled', textAlign: 'right' }}>
                      {new Date(threadDetail.submittedAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                {/* Replies */}
                {threadDetail.replies.map(reply => {
                  const isUser = reply.senderType === 'USER';
                  return (
                    <Box key={reply.id} sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                      <Box sx={{
                        maxWidth: '75%',
                        bgcolor: isUser ? 'var(--color-primary-50, #e3f2fd)' : '#f0f0f0',
                        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        p: 2,
                        border: isUser ? '1px solid var(--color-primary-200, #90caf9)' : 'none',
                      }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                          {isUser ? 'You' : `${reply.senderDisplayName} (Admin)`}
                        </Typography>
                        {!isUser ? (
                          <Box
                            sx={{ mt: 0.5, fontSize: 14, lineHeight: 1.6, '& p': { m: 0 }, '& img': { maxWidth: '100%' } }}
                            dangerouslySetInnerHTML={{ __html: reply.body }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {reply.body}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled', textAlign: 'right' }}>
                          {new Date(reply.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Plain text reply area */}
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Type your reply…"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  disabled={sending || !replyText.trim()}
                  onClick={handleSendReply}
                  sx={{ bgcolor: 'var(--color-primary-500)', '&:hover': { bgcolor: 'var(--color-primary-600)' } }}
                >
                  {sending ? 'Sending…' : 'Reply'}
                </Button>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
