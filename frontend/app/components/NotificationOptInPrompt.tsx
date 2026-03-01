'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/useAuth';
import { apiFetch } from '../lib/api';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  CircularProgress,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import Link from 'next/link';

export default function NotificationOptInPrompt() {
  const { id } = useAuth();
  const isLoggedIn = id !== null;
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success dialog state
  const [successOpen, setSuccessOpen] = useState(false);
  const [successSms, setSuccessSms] = useState(false);

  // Info dialog state (shown after "Don't show again")
  const [infoOpen, setInfoOpen] = useState(false);

  const checkPrompt = useCallback(async () => {
    try {
      const data = await apiFetch<{ showPrompt: boolean }>(
        '/api/notification-preferences/prompt'
      );
      setShow(data.showPrompt);
      if (data.showPrompt) {
        // Record that we showed the prompt (starts the cooldown timer)
        await apiFetch('/api/notification-preferences/prompt-shown', {
          method: 'POST',
        }).catch(() => {});
      }
    } catch {
      setShow(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      checkPrompt();
    } else {
      setShow(false);
    }
  }, [isLoggedIn, checkPrompt]);

  /** User clicked "Subscribe" — opt in via API, hide banner, show success dialog. */
  const handleAccept = async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{ emailOptIn: boolean; smsOptIn: boolean; phoneNumber: string | null }>(
        '/api/notification-preferences/opt-in',
        { method: 'POST' }
      );
      setSuccessSms(result.smsOptIn);
      setShow(false);
      setSuccessOpen(true);
    } catch {
      // Fallback: hide banner anyway so user isn't stuck
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  /** User clicked "Don't show again" — dismiss permanently, show info dialog. */
  const handleDismissForever = async () => {
    try {
      await apiFetch('/api/notification-preferences/dismiss', { method: 'POST' });
    } catch {
      // best-effort
    }
    setShow(false);
    setInfoOpen(true);
  };

  /** User clicked the X — hide for this page view only (cooldown handles re-show). */
  const handleClose = () => {
    setShow(false);
  };

  return (
    <>
      {/* ── Opt-in banner ── */}
      {show && (
        <Box
          sx={{
            mx: 'auto',
            maxWidth: 960,
            width: '100%',
            px: { xs: 2, sm: 3 },
            mt: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
              border: '1px solid #90caf9',
              position: 'relative',
            }}
          >
            <NotificationsActiveIcon sx={{ color: '#1565c0', fontSize: 32 }} />

            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} color="primary.dark">
                Stay in the loop!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opt in to email or SMS notifications so you never miss family updates,
                events, or announcements.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="contained"
                size="small"
                onClick={handleAccept}
                disabled={loading}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {loading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Subscribe'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDismissForever}
                disabled={loading}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Don&apos;t show again
              </Button>
            </Stack>

            <IconButton
              size="small"
              onClick={handleClose}
              sx={{ position: 'absolute', top: 4, right: 4 }}
              aria-label="close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* ── Success dialog (after subscribe) ── */}
      <Dialog
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: 'green' }} />
          You&apos;re Subscribed!
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1 }}>
            You&apos;ve been opted in to <strong>email</strong>
            {successSms && <> and <strong>SMS</strong></>} notifications.
            You&apos;ll now receive family updates, event reminders, and announcements.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            You can change your notification preferences at any time from your{' '}
            <Link
              href="/profile"
              style={{ color: '#1565c0', textDecoration: 'underline' }}
            >
              Profile
            </Link>{' '}
            page.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessOpen(false)} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Info dialog (after "Don't show again") ── */}
      <Dialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActiveIcon color="primary" />
          Notification Preferences
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1 }}>
            No problem! You can always manage your email and SMS notification
            preferences from your{' '}
            <Link
              href="/profile"
              style={{ color: '#1565c0', textDecoration: 'underline' }}
            >
              Profile
            </Link>{' '}
            page whenever you change your mind.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
