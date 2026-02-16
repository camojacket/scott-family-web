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
  Paper,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import PersonAutocomplete from '../components/PersonAutocomplete';
import type { DuesPageDto, DuesBatchDto, DuePeriodResponse, DuePeriodDto } from '../lib/types';

/** Dues amount in cents — $25. Display-only; server enforces actual amount. */
const DUES_AMOUNT_CENTS = 2500;

interface GuestEntry {
  name: string;
  age: string;
}

interface OnBehalfEntry {
  personId: number;
  displayName: string;
}

export default function DuesPage() {
  const { full } = useFamilyName();
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<DuesPageDto | null>(null);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const pollingRef = useRef(false);

  // ── Admin: due period config ──
  const [isAdmin, setIsAdmin] = useState(false);
  const [periodData, setPeriodData] = useState<DuePeriodResponse | null>(null);
  const [periodYear, setPeriodYear] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [periodActive, setPeriodActive] = useState<boolean | undefined>(undefined);
  const [periodEditOpen, setPeriodEditOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // ── Pay-on-behalf state ──
  const [payForSelf, setPayForSelf] = useState(false);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestAge, setGuestAge] = useState('');
  const [onBehalfEntries, setOnBehalfEntries] = useState<OnBehalfEntry[]>([]);
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

  // Detect admin role
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('profile') || '{}');
      const role: string = p?.userRole || '';
      setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
    } catch { /* ignore */ }
  }, []);

  // Load due period config
  const loadPeriod = useCallback(async () => {
    try {
      const data = await apiFetch<DuePeriodResponse>('/api/dues/period');
      setPeriodData(data);
      setPeriodActive(data.active);
      if (data.configured && data.period) {
        setPeriodYear(String(data.period.reunionYear));
        setPeriodStart(data.period.startDate);
        setPeriodEnd(data.period.endDate);
      }
    } catch { /* not critical */ }
  }, []);

  useEffect(() => { loadPeriod(); }, [loadPeriod]);

  const handleSavePeriod = async () => {
    if (!periodYear || !periodStart || !periodEnd) {
      setSnack({ msg: 'All period fields are required', severity: 'error' });
      return;
    }
    setSavingPeriod(true);
    try {
      const saved = await apiFetch<DuePeriodDto>('/api/dues/period', {
        method: 'POST',
        body: {
          reunionYear: parseInt(periodYear, 10),
          startDate: periodStart,
          endDate: periodEnd,
        },
      });
      setSnack({ msg: `Due period saved for ${saved.reunionYear} reunion`, severity: 'success' });
      loadPeriod();
      loadDuesPage(); // refresh dues status with new year
    } catch (err: unknown) {
      setSnack({ msg: (err as Error)?.message || 'Failed to save period', severity: 'error' });
    } finally {
      setSavingPeriod(false);
    }
  };

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
            if (data.selfPaid || data.guestPayments.length > 0 || data.onBehalfPayments.length > 0) {
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
    // Prevent same-session duplicate by name (case-insensitive)
    if (guests.some(g => g.name.toLowerCase() === trimmedName.toLowerCase())) {
      setSnack({ msg: `"${trimmedName}" is already in your list`, severity: 'error' });
      return;
    }
    // Warn if name matches an existing guest payment (any status)
    const existingGuest = pageData?.guestPayments.find(
      gp => gp.guestName?.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingGuest) {
      const statusLabel = existingGuest.status === 'COMPLETED' ? 'paid' :
                          existingGuest.status === 'PENDING' ? 'pending' : 'recorded';
      setSnack({ msg: `"${trimmedName}" already has a ${statusLabel} payment for this year`, severity: 'error' });
      return;
    }
    setGuests(prev => [...prev, { name: trimmedName, age: guestAge }]);
    setGuestName('');
    setGuestAge('');
  };

  const removeGuest = (index: number) => {
    setGuests(prev => prev.filter((_, i) => i !== index));
  };

  const addOnBehalf = (person: { personId: number; displayName: string } | null) => {
    if (!person) return;
    // Prevent duplicates in current cart
    if (onBehalfEntries.some(e => e.personId === person.personId)) {
      setSnack({ msg: 'This person is already in your list', severity: 'error' });
      return;
    }
    // Prevent paying for someone who already has COMPLETED or PENDING dues this year
    if (pageData?.paidPersonIds?.includes(person.personId)) {
      setSnack({ msg: `${person.displayName}'s dues are already paid or pending for this year`, severity: 'error' });
      return;
    }
    setOnBehalfEntries(prev => [...prev, { personId: person.personId, displayName: person.displayName }]);
  };

  const removeOnBehalf = (index: number) => {
    setOnBehalfEntries(prev => prev.filter((_, i) => i !== index));
  };

  const totalPeople = (payForSelf && !pageData?.selfPaid ? 1 : 0) + guests.length + onBehalfEntries.length;
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
          onBehalf: onBehalfEntries.map(e => ({ personId: e.personId, userId: null })),
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
        {periodData?.configured && (
          <Chip
            label={periodActive ? `Dues open: ${periodStart} to ${periodEnd}` : `Dues period closed (was ${periodStart} to ${periodEnd})`}
            size="small"
            color={periodActive ? 'success' : 'default'}
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* ── Admin: Reunion Due Period Config ── */}
      {isAdmin && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="outlined"
            onClick={() => setPeriodEditOpen(o => !o)}
            startIcon={<SettingsIcon />}
            sx={{
              mb: periodEditOpen ? 2 : 0,
              borderColor: 'var(--color-primary-300)',
              color: 'var(--color-primary-600)',
            }}
          >
            {periodEditOpen ? 'Hide' : 'Edit'} Reunion Due Period
          </Button>

          <Collapse in={periodEditOpen}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                border: '1px solid var(--color-primary-200)',
                borderRadius: 'var(--radius-md)',
                bgcolor: 'var(--color-primary-50)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SettingsIcon sx={{ color: 'var(--color-primary-500)' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Reunion Due Period
                </Typography>
                <Chip label="Admin" size="small" color="secondary" sx={{ ml: 'auto' }} />
              </Box>

              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2.5 }}>
                Set the date range during which dues payments apply to a specific reunion year.
                After the end date, payments will count toward the next reunion year.
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Reunion Year"
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 2000, max: 2100 } }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <Button
                  variant="contained"
                  onClick={() => setConfirmSaveOpen(true)}
                  disabled={savingPeriod || !periodYear || !periodStart || !periodEnd}
                  startIcon={savingPeriod ? <CircularProgress size={16} /> : <SaveIcon />}
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: 'var(--color-primary-500)',
                    '&:hover': { bgcolor: 'var(--color-primary-600)' },
                  }}
                >
                  {savingPeriod ? 'Saving...' : 'Save Period'}
                </Button>
              </Stack>

              {periodData?.configured && (
                <Alert severity={periodActive ? 'success' : 'warning'} sx={{ mt: 2, borderRadius: 'var(--radius-md)' }}>
                  {periodActive
                    ? `Dues period is active. Payments are being accepted for the ${periodYear} reunion.`
                    : `Dues period has ended. The configured period was ${periodStart} to ${periodEnd}. Payments now count toward the current calendar year.`}
                </Alert>
              )}
            </Paper>
          </Collapse>

          {/* Confirmation dialog */}
          <Dialog open={confirmSaveOpen} onClose={() => setConfirmSaveOpen(false)}>
            <DialogTitle>Update Reunion Due Period?</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Are you sure you want to save this due period?
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                This will set the <strong>{periodYear}</strong> reunion dues window
                to <strong>{periodStart}</strong> through <strong>{periodEnd}</strong>.
                All dues payments made during this window will be attributed to
                the {periodYear} reunion year. Payments outside this window will
                default to the current calendar year.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmSaveOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={() => { setConfirmSaveOpen(false); handleSavePeriod(); }}
                sx={{
                  bgcolor: 'var(--color-primary-500)',
                  '&:hover': { bgcolor: 'var(--color-primary-600)' },
                }}
              >
                Save Period
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

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
            ) : pageData?.selfPaid && pageData.paidForYouPayment ? (
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32', mb: 1 }}>
                  Paid!
                </Typography>
                <Stack spacing={1} sx={{ textAlign: 'left', maxWidth: 340, mx: 'auto' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Amount</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCents(pageData.paidForYouPayment.amountCents)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Status</Typography>
                    <Chip label="Completed" size="small" color="success" variant="outlined" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Paid by</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {pageData.paidForYouPayment.paidByName ?? 'A family member'}
                    </Typography>
                  </Box>
                  {pageData.paidForYouPayment.paidAt && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Paid on</Typography>
                      <Typography variant="body2">
                        {new Date(pageData.paidForYouPayment.paidAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
                <Alert severity="info" sx={{ mt: 2, borderRadius: 'var(--radius-md)', textAlign: 'left' }}>
                  <Typography variant="body2">
                    Your dues were covered by {pageData.paidForYouPayment.paidByName ?? 'a family member'}. Thank you!
                  </Typography>
                </Alert>
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
          {pageData && (pageData.guestPayments.length > 0 || pageData.onBehalfPayments.length > 0) && (
            <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <GroupIcon sx={{ color: 'var(--color-primary-400)' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Family Members You&apos;ve Paid For
                </Typography>
              </Box>
              <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto' }}>
                {pageData.onBehalfPayments.map(op => (
                  <Box
                    key={op.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      px: 2,
                      borderRadius: 'var(--radius-sm)',
                      bgcolor: op.status === 'FAILED' ? 'var(--color-error-50, #fef2f2)' : 'var(--color-primary-50)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{op.displayName}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        {formatCents(op.amountCents)}
                        {op.status === 'COMPLETED' && op.paidAt && ` • Paid ${new Date(op.paidAt).toLocaleDateString()}`}
                        {op.status === 'PENDING' && ' • Payment processing'}
                        {op.status === 'FAILED' && ` • ${op.notes || 'Payment failed'}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={op.status === 'COMPLETED' ? 'Paid' : op.status === 'PENDING' ? 'Pending' : 'Failed'}
                      size="small"
                      color={op.status === 'COMPLETED' ? 'success' : op.status === 'PENDING' ? 'warning' : 'error'}
                      variant="outlined"
                    />
                  </Box>
                ))}
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
                      bgcolor: gp.status === 'FAILED' ? 'var(--color-error-50, #fef2f2)' : 'var(--color-primary-50)',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{gp.guestName}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        Age {gp.guestAge} &bull; {formatCents(gp.amountCents)}
                        {gp.status === 'PENDING' && ' • Payment processing'}
                        {gp.status === 'FAILED' && ` • ${gp.notes || 'Payment failed'}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={gp.status === 'COMPLETED' ? 'Paid' : gp.status === 'PENDING' ? 'Pending' : 'Failed'}
                      size="small"
                      color={gp.status === 'COMPLETED' ? 'success' : gp.status === 'PENDING' ? 'warning' : 'error'}
                      variant="outlined"
                    />
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
              Pay your own dues and/or pay on behalf of family members.
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

            <Divider sx={{ my: 2 }} />

            {/* Pay for a registered family member */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Pay for a Registered Family Member
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5 }}>
              Search for someone who has a profile in the family tree.
            </Typography>
            <Box sx={{ mb: 2 }}>
              <PersonAutocomplete
                label="Search by name"
                value={null}
                onChange={() => { /* handled by onChangeFull */ }}
                onChangeFull={addOnBehalf}
                placeholder="Type a name to search…"
              />
            </Box>

            {/* On-behalf list */}
            {onBehalfEntries.length > 0 && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {onBehalfEntries.map((entry, i) => (
                  <Box
                    key={entry.personId}
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
                      <Typography sx={{ fontWeight: 600 }}>{entry.displayName}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        {formatCents(DUES_AMOUNT_CENTS)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => removeOnBehalf(i)}
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
