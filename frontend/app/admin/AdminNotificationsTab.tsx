'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import EmailIcon from '@mui/icons-material/Email';
import SmsIcon from '@mui/icons-material/Sms';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { apiFetch } from '../lib/api';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  NotificationLogEntry,
  SubscriberCounts,
} from '../lib/types';

export default function AdminNotificationsTab() {
  // ── State ──────────────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [counts, setCounts] = useState<SubscriberCounts>({ email: 0, sms: 0 });
  const [countsLoading, setCountsLoading] = useState(true);

  const [log, setLog] = useState<NotificationLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Load subscriber counts + log ──────────────────────────
  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [c, l] = await Promise.all([
        apiFetch<SubscriberCounts>('/api/admin/notifications/subscribers'),
        apiFetch<NotificationLogEntry[]>('/api/admin/notifications/log'),
      ]);
      setCounts(c);
      setLog(l);
    } catch (e: unknown) {
      setLoadError((e as Error)?.message || 'Failed to load notification data.');
    }
    setCountsLoading(false);
    setLogLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Send ───────────────────────────────────────────────────
  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setResult({ type: 'error', text: 'Subject and message body are required.' });
      return;
    }
    if (!sendEmail && !sendSms) {
      setResult({ type: 'error', text: 'Select at least one channel (email or SMS).' });
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmSend() {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const resp = await apiFetch<SendNotificationResponse>('/api/admin/notifications/send', {
        method: 'POST',
        body: { subject, body, sendEmail, sendSms } as SendNotificationRequest,
      });
      setResult({ type: 'success', text: resp.message });
      setSubject('');
      setBody('');
      loadData();
    } catch (e: unknown) {
      setResult({ type: 'error', text: (e as Error)?.message || 'Failed to send notification.' });
    } finally {
      setSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <Stack spacing={3}>
      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Send</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Send &ldquo;{subject}&rdquo; to{' '}
            {[sendEmail && `${counts.email} email`, sendSms && `${counts.sms} SMS`]
              .filter(Boolean)
              .join(' + ')}{' '}
            subscriber{counts.email + counts.sms !== 1 ? 's' : ''}? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmSend} variant="contained" color="primary">
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {loadError && (
        <Alert severity="error" onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      {/* Subscriber Counts */}
      <Stack direction="row" spacing={3} flexWrap="wrap">
        <Box
          sx={{
            p: 2,
            border: '1px solid var(--color-gray-200)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 180,
          }}
        >
          <EmailIcon sx={{ color: 'var(--color-primary-600)', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
              {countsLoading ? '—' : counts.email}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              Email subscribers
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            p: 2,
            border: '1px solid var(--color-gray-200)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 180,
          }}
        >
          <SmsIcon sx={{ color: 'var(--color-primary-600)', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
              {countsLoading ? '—' : counts.sms}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
              SMS subscribers
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Divider />

      {/* Compose Notification */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
        Send Notification
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
        Compose a message to send to all subscribers who have opted in.
      </Typography>

      {result && (
        <Alert severity={result.type} onClose={() => setResult(null)}>
          {result.text}
        </Alert>
      )}

      <TextField
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        fullWidth
        size="small"
        placeholder="e.g., Reunion 2026 Update"
      />

      <TextField
        label="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        fullWidth
        multiline
        rows={6}
        placeholder="Write your notification message here..."
      />

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          Send via:
        </Typography>
        <Chip
          icon={<EmailIcon />}
          label={`Email (${counts.email})`}
          variant={sendEmail ? 'filled' : 'outlined'}
          color={sendEmail ? 'primary' : 'default'}
          onClick={() => setSendEmail(!sendEmail)}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          icon={<SmsIcon />}
          label={`SMS (${counts.sms})`}
          variant={sendSms ? 'filled' : 'outlined'}
          color={sendSms ? 'primary' : 'default'}
          onClick={() => setSendSms(!sendSms)}
          sx={{ cursor: 'pointer' }}
        />
      </Stack>

      <Button
        variant="contained"
        startIcon={sending ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SendIcon />}
        onClick={handleSend}
        disabled={sending || (!sendEmail && !sendSms) || !subject.trim() || !body.trim()}
        sx={{
          alignSelf: 'flex-start',
          bgcolor: 'var(--color-primary-500)',
          '&:hover': { bgcolor: 'var(--color-primary-600)' },
          px: 4,
        }}
      >
        {sending ? 'Sending…' : 'Send Notification'}
      </Button>

      <Divider />

      {/* Notification Log */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
        Notification History
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
        Most recent notifications sent (last 50).
      </Typography>

      {logLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : log.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontStyle: 'italic', py: 2 }}>
          No notifications have been sent yet.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Channel</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Recipients</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Sent</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {log.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {entry.subject}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                      {entry.body.length > 120 ? entry.body.slice(0, 120) + '…' : entry.body}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={entry.channel === 'EMAIL' ? <EmailIcon /> : <SmsIcon />}
                      label={entry.channel}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <CheckCircleIcon fontSize="small" sx={{ color: 'var(--color-primary-500)' }} />
                      <Typography variant="body2">{entry.recipientCount}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                      {new Date(entry.sentAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
