'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Snackbar,
  TextField,
  IconButton,
  Divider,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { DuesPageDto, DuesBatchDto } from '../lib/types';

/** Dues amount in cents — $25. Display-only; server enforces actual amount. */
const DUES_AMOUNT_CENTS = 2500;

interface GuestEntry {
  name: string;
  age: string;
}

export default function DuesPage() {
  const { full } = useFamilyName();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<DuesPageDto | null>(null);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const pollingRef = useRef(false);

  // ── Pay-on-behalf state ──
  const [payForSelf, setPayForSelf] = useState(false);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestAge, setGuestAge] = useState('');
  const [, setBatchResult] = useState<DuesBatchDto | null>(null);

  const loadDuesPage = useCallback(async () => {
    try {
      const data = await apiFetch<DuesPageDto>('/api/dues');
      setPageData(data);
      // Default: if self not paid, pre-check "pay for myself"
      if (!data.selfPaid) {
        setPayForSelf(true);
      }
    } catch {
      // Not logged in or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDuesPage(); }, [loadDuesPage]);

  // ── Handle return from Square checkout ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'paid' && params.get('batch')) {
      // Clean the URL without reloading
      window.history.replaceState({}, '', '/dues');
      // Start polling for webhook confirmation
      setVerifying(true);
      pollingRef.current = true;
      const poll = async () => {
        const maxAttempts = 15; // 30 seconds total
        for (let i = 0; i < maxAttempts && pollingRef.current; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const data = await apiFetch<DuesPageDto>('/api/dues');
            setPageData(data);
            // Check if any payments were confirmed since returning
            if (data.selfPaid || data.guestPayments.length > 0) {
              setVerifying(false);
              pollingRef.current = false;
              setSnack({ msg: 'Payment confirmed! Thank you!', severity: 'success' });
              return;
            }
          } catch { /* continue polling */ }
        }
        // Timeout — webhook may still be in flight
        setVerifying(false);
        pollingRef.current = false;
        await loadDuesPage();
        setSnack({
          msg: 'Your payment is being processed. This page will update once confirmed.',
          severity: 'info',
        });
      };
      poll();
    }
    return () => { pollingRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addGuest = () => {
    const trimmedName = guestName.trim();
    const ageNum = parseInt(guestAge, 10);
    if (!trimmedName) {
      setSnack({ msg: 'Please enter a name', severity: 'error' });
      return;
    }
    if (!guestAge || isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      setSnack({ msg: 'Please enter a valid age', severity: 'error' });
      return;
    }
    setGuests(prev => [...prev, { name: trimmedName, age: guestAge }]);
    setGuestName('');
    setGuestAge('');
  };

  const removeGuest = (index: number) => {
    setGuests(prev => prev.filter((_, i) => i !== index));
  };

  const totalPeople = (payForSelf && !pageData?.selfPaid ? 1 : 0) + guests.length;
  const totalCents = totalPeople * DUES_AMOUNT_CENTS;

  const handleCheckout = async () => {
    if (totalPeople === 0) {
      setSnack({ msg: 'Select at least one person to pay for', severity: 'error' });
      return;
    }

    setPaying(true);
    try {
      // Step 1: Create batch of PENDING records
      const batch = await apiFetch<DuesBatchDto>('/api/dues/pay', {
        method: 'POST',
        body: {
          payForSelf: payForSelf && !pageData?.selfPaid,
          guests: guests.map(g => ({ name: g.name, age: parseInt(g.age, 10) })),
        },
      });

      setBatchResult(batch);

      // Step 2: Create Square Checkout payment link and redirect
      const res = await fetch('/api/square/dues-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batch.batchId,
          personCount: batch.personCount,
          reunionYear,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Checkout failed' }));
        throw new Error(data.error || 'Failed to create checkout');
      }

      const { checkoutUrl } = await res.json();
      if (!checkoutUrl) throw new Error('No checkout URL returned');

      // Step 3: Redirect to Square-hosted checkout page
      window.location.href = checkoutUrl;
      return; // Page will unload
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setSnack({ msg: message, severity: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const reunionYear = pageData?.reunionYear ?? new Date().getFullYear();

  return (
    <Box sx={{ maxWidth: 650, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* ── Header ── */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Reunion Dues
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
          Support the annual {full} reunion &mdash; {reunionYear}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : verifying ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Confirming your payment&hellip;
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            Please wait while we verify your payment with Square.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* ══════════════════════════════════════════════
              Section 1: Your Dues Status
             ══════════════════════════════════════════════ */}
          <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Your Dues
            </Typography>

            {pageData?.selfPaid && pageData.selfPayment ? (
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>
                  Paid!
                </Typography>
                <Stack spacing={1} sx={{ textAlign: 'left', maxWidth: 300, mx: 'auto' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Amount</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCents(pageData.selfPayment.amountCents)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Status</Typography>
                    <Chip label="Completed" size="small" color="success" variant="outlined" />
                  </Box>
                  {pageData.selfPayment.paidAt && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Paid on</Typography>
                      <Typography variant="body2">
                        {new Date(pageData.selfPayment.paidAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                  {pageData.selfPayment.squareReceiptUrl && (
                    <Button
                      startIcon={<ReceiptIcon />}
                      href={pageData.selfPayment.squareReceiptUrl}
                      target="_blank"
                      size="small"
                      sx={{ mt: 1 }}
                    >
                      View Receipt
                    </Button>
                  )}
                </Stack>
              </Box>
            ) : (
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
                  {reunionYear} Annual Dues
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
                  {formatCents(DUES_AMOUNT_CENTS)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                  per person &mdash; not yet paid
                </Typography>
              </Box>
            )}
          </Box>

          {/* ══════════════════════════════════════════════
              Section 2: Family Members You've Paid For
             ══════════════════════════════════════════════ */}
          {pageData && pageData.guestPayments.length > 0 && (
            <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <GroupIcon sx={{ color: 'var(--color-primary-400)' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Family Members You&apos;ve Paid For
                </Typography>
              </Box>
              <Stack spacing={1}>
                {pageData.guestPayments.map(gp => (
                  <Box
                    key={gp.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      px: 2,
                      borderRadius: 'var(--radius-sm)',
                      bgcolor: 'var(--color-primary-50)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{gp.guestName}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        Age {gp.guestAge} &bull; {formatCents(gp.amountCents)}
                      </Typography>
                    </Box>
                    <Chip label="Paid" size="small" color="success" variant="outlined" />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* ══════════════════════════════════════════════
              Section 3: Pay Dues (self and/or others)
             ══════════════════════════════════════════════ */}
          <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PersonAddIcon sx={{ color: 'var(--color-primary-400)' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Pay Dues
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
              Pay your own dues and/or pay on behalf of family members who may not have accounts.
              Each person&apos;s dues are {formatCents(DUES_AMOUNT_CENTS)}.
            </Typography>

            {/* Pay for self checkbox */}
            {!pageData?.selfPaid && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={payForSelf}
                    onChange={e => setPayForSelf(e.target.checked)}
                    sx={{ color: 'var(--color-primary-400)', '&.Mui-checked': { color: 'var(--color-primary-500)' } }}
                  />
                }
                label={
                  <Typography sx={{ fontWeight: 600 }}>
                    Pay my dues ({formatCents(DUES_AMOUNT_CENTS)})
                  </Typography>
                }
                sx={{ mb: 2 }}
              />
            )}

            <Divider sx={{ my: 2 }} />

            {/* Add family member form */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Add a Family Member
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <TextField
                label="Full Name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                size="small"
                sx={{ flex: 2 }}
              />
              <TextField
                label="Age"
                type="number"
                value={guestAge}
                onChange={e => setGuestAge(e.target.value)}
                size="small"
                sx={{ flex: 0.7 }}
                slotProps={{ htmlInput: { min: 0, max: 150 } }}
              />
              <Button
                variant="outlined"
                onClick={addGuest}
                sx={{
                  minWidth: 'auto',
                  px: 2,
                  height: 40,
                  borderColor: 'var(--color-primary-300)',
                  color: 'var(--color-primary-600)',
                }}
              >
                + Add
              </Button>
            </Stack>

            {/* Guest list */}
            {guests.length > 0 && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {guests.map((g, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      px: 2,
                      borderRadius: 'var(--radius-sm)',
                      bgcolor: 'var(--color-primary-50)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{g.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        Age {g.age} &bull; {formatCents(DUES_AMOUNT_CENTS)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => removeGuest(i)}
                      sx={{ color: 'var(--color-error-500)' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}

            {/* Checkout summary */}
            {totalPeople > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ color: 'var(--text-secondary)' }}>
                    {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                    {formatCents(totalCents)}
                  </Typography>
                </Box>

                {/* Square checkout redirect */}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleCheckout}
                  disabled={paying}
                  startIcon={paying ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PaymentIcon />}
                  sx={{
                    bgcolor: 'var(--color-primary-500)',
                    '&:hover': { bgcolor: 'var(--color-primary-600)' },
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {paying ? 'Redirecting to Square...' : `Pay ${formatCents(totalCents)}`}
                </Button>
              </>
            )}

            <Alert severity="info" sx={{ mt: 3, borderRadius: 'var(--radius-md)' }}>
              <Typography variant="body2">
                Payments are processed securely through Square&apos;s hosted checkout.
                You can also contact us
                to arrange payment by check or money order.
              </Typography>
            </Alert>
          </Box>
        </Stack>
      )}

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
