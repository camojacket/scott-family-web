'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import type { SessionTimeoutState } from '../lib/useSessionTimeout';

interface Props {
  session: SessionTimeoutState;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${s}s`;
}

/**
 * Modal dialog that warns the user their session is about to expire.
 * Offers "Stay Logged In" (extends session) or "Log Out Now".
 */
export default function SessionTimeoutDialog({ session }: Props) {
  const { showWarning, secondsLeft, extendSession, logoutNow } = session;

  return (
    <Dialog
      open={showWarning}
      onClose={extendSession}
      aria-labelledby="session-timeout-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="session-timeout-title">Session Expiring</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Your session is about to expire due to inactivity. You will be logged out in:
        </DialogContentText>
        <Typography
          variant="h3"
          color="error"
          sx={{ textAlign: 'center', my: 2, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatTime(secondsLeft)}
        </Typography>
        <DialogContentText>
          Click &quot;Stay Logged In&quot; to continue your session, or &quot;Log Out&quot; to end it now.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={logoutNow} color="inherit">
          Log Out
        </Button>
        <Button onClick={extendSession} variant="contained" autoFocus>
          Stay Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
