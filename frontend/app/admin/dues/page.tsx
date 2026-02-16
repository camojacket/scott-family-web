'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import type { DuesStatusDto, DuesSummaryDto, DuePeriodResponse } from '../../lib/types';

const PAGE_SIZES = [10, 50, 100];

type SortField = 'name' | 'dob' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminDuesPage() {
  const [status, setStatus] = useState<DuesStatusDto[]>([]);
  const [summary, setSummary] = useState<DuesSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [year, setYear] = useState(new Date().getFullYear());

  // Load period to get the correct reunion year
  useEffect(() => {
    apiFetch<DuePeriodResponse>('/api/dues/period')
      .then((data) => {
        if (data.configured && data.period) {
          setYear(data.period.reunionYear);
        }
      })
      .catch(() => {});
  }, []);

  // Manual record dialog
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordUserId, setRecordUserId] = useState('');
  const [recordAmount, setRecordAmount] = useState('25.00');
  const [recording, setRecording] = useState(false);

  // Name fields for manual payment
  const [recordFirstName, setRecordFirstName] = useState('');
  const [recordMiddleName, setRecordMiddleName] = useState('');
  const [recordLastName, setRecordLastName] = useState('');
  const [recordPrefix, setRecordPrefix] = useState('');
  const [recordSuffix, setRecordSuffix] = useState('');
  const [recordDob, setRecordDob] = useState('');

  // Pay-on-behalf: multiple people list
  interface ManualEntry {
    firstName: string;
    middleName: string;
    lastName: string;
    prefix: string;
    suffix: string;
    dateOfBirth: string;
    userId: string;
    amount: string;
  }
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, sum] = await Promise.all([
        apiFetch<DuesStatusDto[]>(`/api/dues/admin/status?year=${year}`),
        apiFetch<DuesSummaryDto>(`/api/dues/admin/summary?year=${year}`),
      ]);
      setStatus(s);
      setSummary(sum);
    } catch {
      setSnack({ msg: 'Failed to load dues data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sorting
  const sorted = useMemo(() => {
    const copy = [...status];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.displayName.localeCompare(b.displayName);
      } else if (sortField === 'dob') {
        const aD = a.dateOfBirth ?? '';
        const bD = b.dateOfBirth ?? '';
        cmp = aD.localeCompare(bD);
      } else if (sortField === 'status') {
        cmp = (a.paid ? 1 : 0) - (b.paid ? 1 : 0);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return copy;
  }, [status, sortField, sortDir]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return sorted.slice(start, start + rowsPerPage);
  }, [sorted, page, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const canAddEntry = recordFirstName.trim() && recordLastName.trim();

  const addManualEntry = () => {
    if (!canAddEntry) return;
    setManualEntries(prev => [
      ...prev,
      {
        firstName: recordFirstName.trim(),
        middleName: recordMiddleName.trim(),
        lastName: recordLastName.trim(),
        prefix: recordPrefix.trim(),
        suffix: recordSuffix.trim(),
        dateOfBirth: recordDob.trim(),
        userId: recordUserId.trim(),
        amount: recordAmount || '25.00',
      },
    ]);
    // Reset entry fields but keep amount default
    setRecordFirstName('');
    setRecordMiddleName('');
    setRecordLastName('');
    setRecordPrefix('');
    setRecordSuffix('');
    setRecordDob('');
    setRecordUserId('');
    setRecordAmount('25.00');
  };

  const removeManualEntry = (index: number) => {
    setManualEntries(prev => prev.filter((_, i) => i !== index));
  };

  const resetRecordDialog = () => {
    setRecordFirstName('');
    setRecordMiddleName('');
    setRecordLastName('');
    setRecordPrefix('');
    setRecordSuffix('');
    setRecordDob('');
    setRecordUserId('');
    setRecordAmount('25.00');
    setManualEntries([]);
  };

  const handleRecordPayment = async () => {
    // If there are entries in the list, record each one
    // If no entries but current form is filled, record just the current form
    const toRecord: ManualEntry[] = [...manualEntries];
    if (recordFirstName.trim() && recordLastName.trim()) {
      toRecord.push({
        firstName: recordFirstName.trim(),
        middleName: recordMiddleName.trim(),
        lastName: recordLastName.trim(),
        prefix: recordPrefix.trim(),
        suffix: recordSuffix.trim(),
        dateOfBirth: recordDob.trim(),
        userId: recordUserId.trim(),
        amount: recordAmount || '25.00',
      });
    }

    if (toRecord.length === 0) {
      setSnack({ msg: 'Please add at least one person', severity: 'error' });
      return;
    }

    setRecording(true);
    try {
      let successCount = 0;
      for (const entry of toRecord) {
        await apiFetch('/api/dues/admin/record', {
          method: 'POST',
          body: {
            userId: entry.userId ? parseInt(entry.userId) : null,
            reunionYear: year,
            amountCents: Math.round(parseFloat(entry.amount) * 100),
            firstName: entry.firstName,
            middleName: entry.middleName || null,
            lastName: entry.lastName,
            prefix: entry.prefix || null,
            suffix: entry.suffix || null,
            dateOfBirth: entry.dateOfBirth || null,
          },
        });
        successCount++;
      }
      setRecordOpen(false);
      resetRecordDialog();
      setSnack({
        msg: `${successCount} payment${successCount > 1 ? 's' : ''} recorded`,
        severity: 'success',
      });
      load();
    } catch {
      setSnack({ msg: 'Failed to record payment', severity: 'error' });
    } finally {
      setRecording(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Button component={Link} href="/admin" startIcon={<ArrowBackIcon />} sx={{ color: 'var(--text-secondary)', mb: 1 }}>
            Back to Admin
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
            Dues Tracking — {year}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => setRecordOpen(true)} startIcon={<PaymentIcon />}>
          Record Payment
        </Button>
      </Box>

      {/* Summary cards */}
      {summary && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
          <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
              {summary.totalMembers}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Total Members</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#2e7d32' }}>
              {summary.totalPaid}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Paid</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#d32f2f' }}>
              {summary.totalUnpaid}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Unpaid</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
              {formatCents(summary.totalCollectedCents)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Collected</Typography>
          </Paper>
        </Stack>
      )}

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box className="card" sx={{ p: { xs: 1, sm: 2 } }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'name'}
                      direction={sortField === 'name' ? sortDir : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'dob'}
                      direction={sortField === 'dob' ? sortDir : 'asc'}
                      onClick={() => handleSort('dob')}
                    >
                      Date of Birth
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'status'}
                      direction={sortField === 'status' ? sortDir : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Paid By</TableCell>
                  <TableCell>Paid On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((row, idx) => (
                  <TableRow key={row.userId ?? `p${row.personId}` ?? `i${idx}`}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {row.displayName}
                      {!row.userId && row.personId && (
                        <Chip label="Profile" size="small" variant="outlined" sx={{ ml: 1 }} />
                      )}
                      {!row.userId && !row.personId && (
                        <Chip label="Guest" size="small" variant="outlined" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>{row.dateOfBirth ?? '—'}</TableCell>
                    <TableCell>
                      {row.paid ? (
                        <Chip label="Paid" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip label="Unpaid" size="small" color="error" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>{row.paid ? formatCents(row.amountCents) : '—'}</TableCell>
                    <TableCell>
                      {row.paidByName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={sorted.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={PAGE_SIZES}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Box>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={recordOpen} onClose={() => setRecordOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Manual Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
            Record a cash, check, or money order payment. Add one or more people below.
          </Typography>

          {/* Name fields */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              label="Prefix"
              value={recordPrefix}
              onChange={e => setRecordPrefix(e.target.value)}
              size="small"
              sx={{ flex: 0.7 }}
              placeholder="Mr., Mrs."
            />
            <TextField
              fullWidth
              required
              label="First Name"
              value={recordFirstName}
              onChange={e => setRecordFirstName(e.target.value)}
              size="small"
              sx={{ flex: 1.5 }}
            />
            <TextField
              fullWidth
              label="Middle Name"
              value={recordMiddleName}
              onChange={e => setRecordMiddleName(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              fullWidth
              required
              label="Last Name"
              value={recordLastName}
              onChange={e => setRecordLastName(e.target.value)}
              size="small"
              sx={{ flex: 1.5 }}
            />
            <TextField
              label="Suffix"
              value={recordSuffix}
              onChange={e => setRecordSuffix(e.target.value)}
              size="small"
              sx={{ flex: 0.7 }}
              placeholder="Jr., Sr."
            />
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField
              fullWidth
              label="Date of Birth"
              value={recordDob}
              onChange={e => setRecordDob(e.target.value)}
              size="small"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <TextField
              fullWidth
              label="User ID (optional)"
              value={recordUserId}
              onChange={e => setRecordUserId(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              helperText="Link to account if known"
            />
          </Stack>

          <TextField
            fullWidth
            label="Amount ($)"
            value={recordAmount}
            onChange={e => setRecordAmount(e.target.value)}
            size="small"
            type="number"
            sx={{ mb: 2 }}
          />

          <Button
            variant="outlined"
            onClick={addManualEntry}
            disabled={!canAddEntry}
            startIcon={<PersonAddIcon />}
            size="small"
            sx={{ mb: 2 }}
          >
            Add Person to List
          </Button>

          {/* Added entries list */}
          {manualEntries.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                People to Record ({manualEntries.length})
              </Typography>
              <Stack spacing={1} sx={{ mb: 1 }}>
                {manualEntries.map((entry, i) => {
                  const parts = [
                    entry.prefix,
                    entry.firstName,
                    entry.middleName,
                    entry.lastName,
                    entry.suffix,
                  ].filter(Boolean);
                  return (
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
                        <Typography sx={{ fontWeight: 600 }}>{parts.join(' ')}</Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                          ${parseFloat(entry.amount).toFixed(2)}
                          {entry.userId && ` \u2022 User #${entry.userId}`}
                          {entry.dateOfBirth && ` \u2022 DOB: ${entry.dateOfBirth}`}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => removeManualEntry(i)}
                        sx={{ color: 'var(--color-error-500)' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRecordOpen(false); resetRecordDialog(); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordPayment}
            disabled={recording || (manualEntries.length === 0 && !canAddEntry)}
          >
            {recording ? 'Recording...' : manualEntries.length > 0
              ? `Record ${manualEntries.length + (canAddEntry ? 1 : 0)} Payment${manualEntries.length + (canAddEntry ? 1 : 0) > 1 ? 's' : ''}`
              : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
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
