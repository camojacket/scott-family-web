'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Box, Button, TextField, Alert, Stack, Link, Typography } from '@mui/material';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';

export default function LoginPage() {
  const { full } = useFamilyName();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/profile';
  const reason = sp.get('reason');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success'|'error'|'info'; text: string }|null>(
    reason === 'timeout'
      ? { type: 'info', text: 'You were logged out due to inactivity.' }
      : reason === 'expired'
        ? { type: 'info', text: 'Your session has expired. Please log in again.' }
        : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const resp = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const ct = resp.headers.get('Content-Type') || '';
        if (ct.includes('application/json')) {
          const data = await resp.json();
          if (data.error === 'BANNED') {
            const isPermanent = data.bannedUntil === 'permanent';
            const until = isPermanent
              ? ''
              : ` until ${new Date(data.bannedUntil).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}`;
            const reason = data.banReason ? `\n\nReason: ${data.banReason}` : '';
            setMsg({
              type: 'error',
              text: `Your account has been ${isPermanent ? 'permanently banned' : `suspended${until}`}.${reason}\n\nPlease contact an administrator if you believe this is an error.`,
            });
            return;
          }
          if (data.error === 'TOO_MANY_ATTEMPTS') {
            setMsg({
              type: 'error',
              text: `Too many login attempts. Please try again in ${data.retryAfterSeconds} seconds.`,
            });
            return;
          }
          if (data.error === 'INVALID_CREDENTIALS') {
            setMsg({ type: 'error', text: 'Invalid username or password.' });
            return;
          }
          if (data.error === 'ACCOUNT_RESTRICTED') {
            setMsg({ type: 'error', text: data.message || 'Account access restricted.' });
            return;
          }
          throw new Error(data.message || data.error || 'Login failed');
        }
        const text = await resp.text();
        throw new Error(text || 'Login failed');
      }

      const profile = await resp.json();
      localStorage.setItem('profile', JSON.stringify(profile));
      // Set a session marker cookie on the frontend domain so middleware knows we're logged in.
      // The actual auth session (JSESSIONID) lives on the backend domain.
      document.cookie = 'sf_sess=1; path=/; max-age=86400; SameSite=Lax; Secure';
      window.dispatchEvent(new Event('profile-updated'));
      router.replace(next);
    } catch (err: unknown) {
      if (!msg) setMsg({ type: 'error', text: (err as Error)?.message || 'Login failed' });
    } finally {
      setLoading(false);
    }
  }

  async function onForgotUsername() {
    const email = prompt('Enter your email to retrieve your username');
    if (!email) return;
    try {
      await apiFetch('/api/auth/forgot-username', { method: 'POST', body: { email } });
      setMsg({ type: 'info', text: 'If the email exists, your username has been sent.' });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to send username email' });
    }
  }

  async function onForgotPassword() {
    const email = prompt('Enter your email to reset your password');
    if (!email) return;
    try {
      await apiFetch('/api/auth/request-password-reset', { method: 'POST', body: { email } });
      setMsg({ type: 'info', text: 'If the email exists, a reset link has been sent.' });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to send reset email' });
    }
  }

  return (
    <Box sx={{ maxWidth: 440, mx: 'auto', py: { xs: 4, sm: 8 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: 'var(--color-primary-700)', letterSpacing: '-0.02em', mb: 0.5 }}
        >
          Welcome Back
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Sign in to access the {full} family site
        </Typography>
      </Box>

      <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
        {msg && <Alert severity={msg.type === 'info' ? 'info' : msg.type} sx={{ mb: 3, whiteSpace: 'pre-line' }}>{msg.text}</Alert>}
        <form onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
              <Link
                component="button"
                type="button"
                onClick={onForgotUsername}
                sx={{ fontSize: '0.82rem', color: 'var(--color-primary-500)' }}
              >
                Forgot username?
              </Link>
              <Link
                component="button"
                type="button"
                onClick={onForgotPassword}
                sx={{ fontSize: '0.82rem', color: 'var(--color-primary-500)' }}
              >
                Forgot password?
              </Link>
            </Stack>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              size="large"
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
                py: 1.25,
              }}
            >
              {loading ? 'Logging in…' : 'Login'}
            </Button>
          </Stack>
        </form>
      </Box>

      <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: 'var(--text-secondary)' }}>
        Don&apos;t have an account?{' '}
        <a href="/signup" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>Sign up</a>
      </Typography>
    </Box>
  );
}
