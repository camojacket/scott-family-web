'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  Snackbar,
  Chip,
} from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { DonationDto } from '../lib/types';

const PRESET_AMOUNTS = [2500, 5000, 10000, 25000]; // $25, $50, $100, $250
const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 1_000_000;

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function DonatePage() {
  const { full } = useFamilyName();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // Post-payment state
  const [verifying, setVerifying] = useState(false);
  const [confirmedDonation, setConfirmedDonation] = useState<DonationDto | null>(null);
  const pollingRef = useRef(false);

  const effectiveAmountCents = amountCents ?? (customAmount ? Math.round(parseFloat(customAmount) * 100) : 0);
  const isValidAmount = effectiveAmountCents >= MIN_AMOUNT_CENTS && effectiveAmountCents <= MAX_AMOUNT_CENTS;

  // Handle return from Square checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'paid' && params.get('donationId')) {
      const donationId = params.get('donationId');
      window.history.replaceState({}, '', '/donate');
      setVerifying(true);
      pollingRef.current = true;

      const poll = async () => {
        const backendBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
        const maxAttempts = 15;
        for (let i = 0; i < maxAttempts && pollingRef.current; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const resp = await fetch(`${backendBase}/api/donations/${donationId}`, {
              credentials: 'include',
            });
            if (resp.ok) {
              const donation: DonationDto = await resp.json();
              if (donation.status === 'COMPLETED') {
                setConfirmedDonation(donation);
                setVerifying(false);
                pollingRef.current = false;
                return;
              }
            }
          } catch { /* continue polling */ }
        }
        setVerifying(false);
        pollingRef.current = false;
        setSnack({
          msg: 'Your donation is being processed. You should receive a receipt from Square shortly.',
          severity: 'info',
        });
      };
      poll();
    }
    return () => { pollingRef.current = false; };
  }, []);

  const handleSelectPreset = (cents: number) => {
    setAmountCents(cents);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setAmountCents(null);
  };

  const handleDonate = async () => {
    if (!name.trim()) {
      setSnack({ msg: 'Please enter your name', severity: 'error' });
      return;
    }
    if (!isValidAmount) {
      setSnack({ msg: 'Please enter an amount between $1.00 and $10,000.00', severity: 'error' });
      return;
    }

    setPaying(true);
    try {
      const backendBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

      // Step 1: Create PENDING donation (guest endpoint, no auth required)
      const createResp = await fetch(`${backendBase}/api/donations/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          amountCents: effectiveAmountCents,
          note: note.trim() || null,
        }),
      });

      if (!createResp.ok) {
        const data = await createResp.json().catch(() => ({ error: 'Failed to create donation' }));
        throw new Error(data.error || 'Failed to create donation');
      }

      const donation: DonationDto = await createResp.json();

      // Step 2: Create Square checkout link (guest endpoint, no auth required)
      const checkoutResp = await fetch('/api/square/guest-donation-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: donation.id,
          amountCents: donation.amountCents,
          name: name.trim(),
          note: note.trim() || null,
        }),
      });

      if (!checkoutResp.ok) {
        const data = await checkoutResp.json().catch(() => ({ error: 'Checkout failed' }));
        throw new Error(data.error || 'Failed to create checkout');
      }

      const { checkoutUrl } = await checkoutResp.json();
      if (!checkoutUrl) throw new Error('No checkout URL returned');

      // Step 3: Redirect to Square
      window.location.href = checkoutUrl;
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Donation failed';
      setSnack({ msg: message, severity: 'error' });
    } finally {
      setPaying(false);
    }
  };

  // ── Confirmed donation view ──
  if (confirmedDonation) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 4, sm: 8 } }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: '#2e7d32', mb: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#2e7d32', mb: 1 }}>
            Thank You!
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-secondary)' }}>
            Your donation of {formatCents(confirmedDonation.amountCents)} has been received.
          </Typography>
        </Box>

        <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Amount</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCents(confirmedDonation.amountCents)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Status</Typography>
              <Chip label="Completed" size="small" color="success" variant="outlined" />
            </Box>
            {confirmedDonation.note && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Note</Typography>
                <Typography variant="body2">{confirmedDonation.note}</Typography>
              </Box>
            )}
            {confirmedDonation.squareReceiptUrl && (
              <Button
                startIcon={<ReceiptIcon />}
                href={confirmedDonation.squareReceiptUrl}
                target="_blank"
                size="small"
                sx={{ mt: 1 }}
              >
                View Receipt
              </Button>
            )}
          </Stack>
        </Box>

        <Stack spacing={2} sx={{ mt: 4, alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => {
              setConfirmedDonation(null);
              setName('');
              setEmail('');
              setAmountCents(null);
              setCustomAmount('');
              setNote('');
            }}
            sx={{
              borderColor: 'var(--color-primary-300)',
              color: 'var(--color-primary-600)',
            }}
          >
            Make Another Donation
          </Button>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            <a href="/login" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>
              Sign in
            </a>{' '}
            or{' '}
            <a href="/signup" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>
              create an account
            </a>{' '}
            to access the full family site.
          </Typography>
        </Stack>
      </Box>
    );
  }

  // ── Verifying payment view ──
  if (verifying) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 4, sm: 8 }, textAlign: 'center' }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Confirming your donation&hellip;
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Please wait while we verify your payment with Square.
        </Typography>
      </Box>
    );
  }

  // ── Donation form ──
  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 4, sm: 8 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <VolunteerActivismIcon sx={{ fontSize: 48, color: 'var(--color-primary-500)', mb: 1 }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: 'var(--color-primary-700)', letterSpacing: '-0.02em', mb: 0.5 }}
        >
          Make a Donation
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Support the {full} family reunion &mdash; no account required
        </Typography>
      </Box>

      <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3}>
          {/* Name & Email */}
          <TextField
            label="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Email (optional — for receipt)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            helperText="We'll only use this for your Square receipt"
          />

          {/* Amount selection */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Select Amount
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {PRESET_AMOUNTS.map((cents) => (
                <Button
                  key={cents}
                  variant={amountCents === cents ? 'contained' : 'outlined'}
                  onClick={() => handleSelectPreset(cents)}
                  sx={{
                    minWidth: 80,
                    ...(amountCents === cents
                      ? {
                          bgcolor: 'var(--color-primary-500)',
                          '&:hover': { bgcolor: 'var(--color-primary-600)' },
                        }
                      : {
                          borderColor: 'var(--color-primary-300)',
                          color: 'var(--color-primary-600)',
                        }),
                  }}
                >
                  {formatCents(cents)}
                </Button>
              ))}
            </Box>
            <TextField
              label="Custom Amount"
              type="number"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              fullWidth
              size="small"
              slotProps={{
                htmlInput: { min: 1, max: 10000, step: 0.01 },
                input: {
                  startAdornment: (
                    <Typography sx={{ mr: 0.5, color: 'var(--text-secondary)' }}>$</Typography>
                  ),
                },
              }}
              helperText="Minimum $1.00"
            />
          </Box>

          {/* Note */}
          <TextField
            label="Dedication or Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="In memory of…, For the youth fund, etc."
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />

          {/* Amount summary */}
          {isValidAmount && (
            <Box
              sx={{
                bgcolor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-200)',
                borderRadius: 'var(--radius-md)',
                p: 2,
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                Donation Amount
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
                {formatCents(effectiveAmountCents)}
              </Typography>
            </Box>
          )}

          {/* Submit */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleDonate}
            disabled={paying || !name.trim() || !isValidAmount}
            startIcon={paying ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <VolunteerActivismIcon />}
            sx={{
              bgcolor: 'var(--color-primary-500)',
              '&:hover': { bgcolor: 'var(--color-primary-600)' },
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {paying ? 'Redirecting to Square...' : `Donate ${isValidAmount ? formatCents(effectiveAmountCents) : ''}`}
          </Button>

          <Alert severity="info" sx={{ borderRadius: 'var(--radius-md)' }}>
            <Typography variant="body2">
              Payments are processed securely through Square&apos;s hosted checkout.
              Donations are separate from reunion dues.
            </Typography>
          </Alert>
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ textAlign: 'center', mt: 3, color: 'var(--text-secondary)' }}>
        Have an account?{' '}
        <a href="/login" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>Sign in</a>
        {' '}to donate from your profile, or{' '}
        <a href="/signup" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>sign up</a>
        {' '}for full access.
      </Typography>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
