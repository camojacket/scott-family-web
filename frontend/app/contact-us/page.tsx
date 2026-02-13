// app/contact-us/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { TextField, Button, Box, Typography, Alert, CircularProgress, Stack } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import { apiFetch, ApiError } from '../lib/api';

function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p = JSON.parse(raw);
        setName(p.displayName || '');
        setEmail(p.email || '');
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: { name, email, message },
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSubmitted(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Contact Us
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
          We&apos;d love to hear from you
        </Typography>
      </Box>

      {submitted ? (
        <Box className="card" sx={{ p: 5, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 52, color: '#4caf50', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--foreground)', mb: 1 }}>
            Message Sent!
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)' }}>
            Thank you! We&apos;ll get back to you soon.
          </Typography>
        </Box>
      ) : (
        <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
          <form onSubmit={handleSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
            <Stack spacing={2.5}>
              {(name || email) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.5, borderRadius: 1, bgcolor: 'var(--color-primary-50, #f0f7ff)' }}>
                  {name && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                      <Typography variant="body2" sx={{ color: 'var(--foreground)', fontWeight: 500 }}>{name}</Typography>
                    </Stack>
                  )}
                  {email && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                      <Typography variant="body2" sx={{ color: 'var(--foreground)', fontWeight: 500 }}>{email}</Typography>
                    </Stack>
                  )}
                </Box>
              )}
              <TextField
                label="Message"
                name="message"
                multiline
                rows={5}
                fullWidth
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <Button
                variant="contained"
                type="submit"
                fullWidth
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                sx={{
                  bgcolor: 'var(--color-primary-500)',
                  '&:hover': { bgcolor: 'var(--color-primary-600)' },
                  py: 1.25,
                }}
              >
                {submitting ? 'Sending…' : 'Send Message'}
              </Button>
            </Stack>
          </form>
        </Box>
      )}
    </Box>
  );
}

export default dynamic(() => Promise.resolve(ContactPage), { ssr: false });
