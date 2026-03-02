'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/useAuth';
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import ReceiptIcon from '@mui/icons-material/Receipt';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import type { DonationDto, DonationSummaryDto } from '../../lib/types';

const PAGE_SIZES = [10, 50, 100];

type SortField = 'date' | 'amount' | 'name' | 'status';
type SortDir = 'asc' | 'desc';

export default function AdminDonationsPage() {
  const router = useRouter();
  const { isAdmin, adminLoading } = useAuth();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.replace('/');
    }
  }, [adminLoading, isAdmin, router]);

  const [donations, setDonations] = useState<DonationDto[]>([]);
  const [summary, setSummary] = useState<DonationSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const load = async () => {
    try {
      const [donationList, summaryData] = await Promise.all([
        apiFetch<DonationDto[]>('/api/donations/admin/list'),
        apiFetch<DonationSummaryDto>('/api/donations/admin/summary'),
      ]);
      setDonations(donationList);
      setSummary(summaryData);
    } catch {
      setSnack({ msg: 'Failed to load donations', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let list = donations;
    if (statusFilter !== 'ALL') {
      list = list.filter(d => d.status === statusFilter);
    }
    return list;
  }, [donations, statusFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
          break;
        case 'amount':
          cmp = a.amountCents - b.amountCents;
          break;
        case 'name':
          cmp = (a.displayName || a.guestName || '').localeCompare(b.displayName || b.guestName || '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const paged = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (adminLoading || (!isAdmin && !adminLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Button component={Link} href="/admin" startIcon={<ArrowBackIcon />} size="small">
          Admin
        </Button>
        <VolunteerActivismIcon sx={{ color: 'var(--color-primary-500)' }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Donations
        </Typography>
      </Stack>

      {/* Summary cards */}
      {summary && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Paper
            elevation={0}
            sx={{ flex: 1, p: 2, textAlign: 'center', border: '1px solid var(--color-primary-200)', borderRadius: 'var(--radius-md)' }}
          >
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Total Donations</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
              {formatCents(summary.totalAmountCents)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              {summary.totalDonations} donation{summary.totalDonations !== 1 ? 's' : ''}
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{ flex: 1, p: 2, textAlign: 'center', border: '1px solid #66bb6a', borderRadius: 'var(--radius-md)' }}
          >
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Completed</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#2e7d32' }}>
              {summary.completedCount}
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{ flex: 1, p: 2, textAlign: 'center', border: '1px solid #ffa726', borderRadius: 'var(--radius-md)' }}
          >
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Pending</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#e65100' }}>
              {summary.pendingCount}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Filter */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="REFUNDED">Refunded</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          {filtered.length} donation{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Stack>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : donations.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 'var(--radius-md)' }}>
          No donations yet.
        </Alert>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid var(--color-primary-100)', borderRadius: 'var(--radius-md)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                    Donor
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel active={sortField === 'amount'} direction={sortField === 'amount' ? sortDir : 'asc'} onClick={() => handleSort('amount')}>
                    Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell>Note</TableCell>
                <TableCell>
                  <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel active={sortField === 'date'} direction={sortField === 'date' ? sortDir : 'desc'} onClick={() => handleSort('date')}>
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {d.displayName || d.guestName || 'Anonymous'}
                    </Typography>
                    {d.guestEmail && (
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {d.guestEmail}
                      </Typography>
                    )}
                    {!d.userId && (
                      <Chip label="Guest" size="small" variant="outlined" sx={{ ml: 0.5, fontSize: '0.65rem', height: 18 }} />
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatCents(d.amountCents)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.note || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={d.status}
                      size="small"
                      color={
                        d.status === 'COMPLETED' ? 'success' :
                        d.status === 'PENDING' ? 'warning' :
                        d.status === 'REFUNDED' ? 'info' : 'error'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {d.paidAt
                        ? new Date(d.paidAt).toLocaleDateString()
                        : d.createdAt
                          ? new Date(d.createdAt).toLocaleDateString()
                          : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {d.squareReceiptUrl ? (
                      <Button
                        size="small"
                        href={d.squareReceiptUrl}
                        target="_blank"
                        startIcon={<ReceiptIcon fontSize="small" />}
                        sx={{ minWidth: 'auto', fontSize: '0.75rem' }}
                      >
                        View
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={PAGE_SIZES}
          />
        </TableContainer>
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
