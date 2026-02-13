'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import { apiFetch } from '../lib/api';

type PendingSignup = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  requestedAt: string;
};

type ChangeItem = {
  id: number;
  userId: number;
  field: 'displayName' | 'motherId' | 'fatherId';
  oldValue: string | null;
  newValue: string;
  requestedAt: string;
  username: string;
  displayName: string;
};

type PersonRequestItem = {
  id: number;
  userId: number;
  requesterDisplayName: string;
  action: 'ADD' | 'UPDATE' | 'LINK_CHILD';
  targetPersonId?: number | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  motherId?: number | null;
  fatherId?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  parentPersonId?: number | null;
  relation?: string | null;
  parentDisplayName?: string | null;
};

const PAGE_SIZES = [10, 50, 100];

export default function AdminPage() {
  const [tab, setTab] = useState(0);

  // -------- Pending signups state --------
  const [signups, setSignups] = useState<PendingSignup[]>([]);
  const [signupMsg, setSignupMsg] = useState<{ type: 'success'|'error'|'info'; text: string }|null>(null);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [selectedSignups, setSelectedSignups] = useState<number[]>([]);
  const [pageSignups, setPageSignups] = useState(0);
  const [rowsPerPageSignups, setRowsPerPageSignups] = useState(PAGE_SIZES[0]);

  const sortedSignups = useMemo(
    () => [...signups].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    [signups]
  );
  const pagedSignups = useMemo(() => {
    const start = pageSignups * rowsPerPageSignups;
    return sortedSignups.slice(start, start + rowsPerPageSignups);
  }, [sortedSignups, pageSignups, rowsPerPageSignups]);

  const signupIdsOnPage = pagedSignups.map(r => r.id);
  const isAllSignupsOnPage = signupIdsOnPage.length > 0 && signupIdsOnPage.every(id => selectedSignups.includes(id));
  const isSomeSignupsOnPage = signupIdsOnPage.some(id => selectedSignups.includes(id)) && !isAllSignupsOnPage;

  // -------- Profile changes state --------
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [changeMsg, setChangeMsg] = useState<{ type: 'success'|'error'|'info'; text: string }|null>(null);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [selectedChanges, setSelectedChanges] = useState<number[]>([]);
  const [pageChanges, setPageChanges] = useState(0);
  const [rowsPerPageChanges, setRowsPerPageChanges] = useState(PAGE_SIZES[0]);

  const sortedChanges = useMemo(
    () => [...changes].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    [changes]
  );
  const pagedChanges = useMemo(() => {
    const start = pageChanges * rowsPerPageChanges;
    return sortedChanges.slice(start, start + rowsPerPageChanges);
  }, [sortedChanges, pageChanges, rowsPerPageChanges]);

  const changeIdsOnPage = pagedChanges.map(r => r.id);
  const isAllChangesOnPage = changeIdsOnPage.length > 0 && changeIdsOnPage.every(id => selectedChanges.includes(id));
  const isSomeChangesOnPage = changeIdsOnPage.some(id => selectedChanges.includes(id)) && !isAllChangesOnPage;

  // -------- People requests state --------
  const [peopleReqs, setPeopleReqs] = useState<PersonRequestItem[]>([]);
  const [peopleMsg, setPeopleMsg] = useState<{ type: 'success'|'error'|'info'; text: string }|null>(null);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [selectedPeopleReqs, setSelectedPeopleReqs] = useState<number[]>([]);
  const [pagePeople, setPagePeople] = useState(0);
  const [rowsPerPagePeople, setRowsPerPagePeople] = useState(PAGE_SIZES[0]);

  const sortedPeopleReqs = useMemo(
    () => [...peopleReqs].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    [peopleReqs]
  );
  const pagedPeopleReqs = useMemo(() => {
    const start = pagePeople * rowsPerPagePeople;
    return sortedPeopleReqs.slice(start, start + rowsPerPagePeople);
  }, [sortedPeopleReqs, pagePeople, rowsPerPagePeople]);

  const peopleIdsOnPage = pagedPeopleReqs.map(r => r.id);
  const isAllPeopleOnPage = peopleIdsOnPage.length > 0 && peopleIdsOnPage.every(id => selectedPeopleReqs.includes(id));
  const isSomePeopleOnPage = peopleIdsOnPage.some(id => selectedPeopleReqs.includes(id)) && !isAllPeopleOnPage;

  // -------- Load data when switching tabs --------
  useEffect(() => {
    let mounted = true;

    async function loadSignups() {
      setLoadingSignups(true);
      setSignupMsg(null);
      try {
        const res = await apiFetch<PendingSignup[]>('/api/admin/pending-signups', { method: 'GET' });
        if (mounted) setSignups(res);
      } catch (e: any) {
        if (mounted) setSignupMsg({ type: 'error', text: e?.message || 'Failed to load pending signups' });
      } finally {
        if (mounted) setLoadingSignups(false);
      }
    }

    async function loadChanges() {
      setLoadingChanges(true);
      setChangeMsg(null);
      try {
        const res = await apiFetch<ChangeItem[]>('/api/admin/pending-profile-changes', { method: 'GET' });
        if (mounted) setChanges(res);
      } catch (e: any) {
        if (mounted) setChangeMsg({ type: 'error', text: e?.message || 'Failed to load profile change requests' });
      } finally {
        if (mounted) setLoadingChanges(false);
      }
    }

    async function loadPeopleRequests() {
      setLoadingPeople(true);
      setPeopleMsg(null);
      try {
        const res = await apiFetch<PersonRequestItem[]>('/api/admin/people/requests', { method: 'GET' });
        if (mounted) setPeopleReqs(res);
      } catch (e: any) {
        if (mounted) setPeopleMsg({ type: 'error', text: e?.message || 'Failed to load people requests' });
      } finally {
        if (mounted) setLoadingPeople(false);
      }
    }

    if (tab === 0) loadSignups();
    if (tab === 1) loadChanges();
    if (tab === 2) loadPeopleRequests();

    return () => { mounted = false; };
  }, [tab]);

  // -------- Selection helpers --------
  const toggleAllSignupsOnPage = () => {
    setSelectedSignups(prev => {
      if (isAllSignupsOnPage) {
        // unselect all on page
        return prev.filter(id => !signupIdsOnPage.includes(id));
      }
      // add all on page
      const set = new Set(prev);
      signupIdsOnPage.forEach(id => set.add(id));
      return Array.from(set);
    });
  };
  const toggleSignup = (id: number) =>
    setSelectedSignups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAllChangesOnPage = () => {
    setSelectedChanges(prev => {
      if (isAllChangesOnPage) {
        return prev.filter(id => !changeIdsOnPage.includes(id));
      }
      const set = new Set(prev);
      changeIdsOnPage.forEach(id => set.add(id));
      return Array.from(set);
    });
  };
  const toggleChange = (id: number) =>
    setSelectedChanges(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAllPeopleOnPage = () => {
    setSelectedPeopleReqs(prev => {
      if (isAllPeopleOnPage) {
        return prev.filter(id => !peopleIdsOnPage.includes(id));
      }
      const set = new Set(prev);
      peopleIdsOnPage.forEach(id => set.add(id));
      return Array.from(set);
    });
  };
  const togglePeopleReq = (id: number) =>
    setSelectedPeopleReqs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // -------- Actions: Signups (bulk + single) --------
  async function approveSelectedSignups() {
    if (selectedSignups.length === 0) return;
    try {
      setLoadingSignups(true);
      setSignupMsg(null);
      await apiFetch(`/api/admin/approve`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedSignups }),
        headers: { 'Content-Type': 'application/json' }
      });
      setSignups(arr => arr.filter(s => !selectedSignups.includes(s.id)));
      setSelectedSignups([]);
      setSignupMsg({ type: 'success', text: 'Approved selected signups.' });
    } catch (e: any) {
      setSignupMsg({ type: 'error', text: e?.message || 'Failed to approve selected signups' });
    } finally {
      setLoadingSignups(false);
    }
  }
  async function rejectSelectedSignups() {
    if (selectedSignups.length === 0) return;
    try {
      setLoadingSignups(true);
      setSignupMsg(null);
      await apiFetch(`/api/admin/reject`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedSignups }),
        headers: { 'Content-Type': 'application/json' }
      });
      setSignups(arr => arr.filter(s => !selectedSignups.includes(s.id)));
      setSelectedSignups([]);
      setSignupMsg({ type: 'success', text: 'Rejected selected signups.' });
    } catch (e: any) {
      setSignupMsg({ type: 'error', text: e?.message || 'Failed to reject selected signups' });
    } finally {
      setLoadingSignups(false);
    }
  }
  async function approveSignup(id: number) {
    try {
      setLoadingSignups(true);
      await apiFetch(`/api/admin/approve/${id}`, { method: 'POST' });
      setSignups(arr => arr.filter(s => s.id !== id));
      setSelectedSignups(prev => prev.filter(x => x !== id));
      setSignupMsg({ type: 'success', text: 'Signup approved.' });
    } catch (e: any) {
      setSignupMsg({ type: 'error', text: e?.message || 'Failed to approve signup' });
    } finally {
      setLoadingSignups(false);
    }
  }
  async function rejectSignup(id: number) {
    try {
      setLoadingSignups(true);
      await apiFetch(`/api/admin/reject/${id}`, { method: 'DELETE' });
      setSignups(arr => arr.filter(s => s.id !== id));
      setSelectedSignups(prev => prev.filter(x => x !== id));
      setSignupMsg({ type: 'success', text: 'Signup rejected.' });
    } catch (e: any) {
      setSignupMsg({ type: 'error', text: e?.message || 'Failed to reject signup' });
    } finally {
      setLoadingSignups(false);
    }
  }

  // -------- Actions: Profile changes (per-id loop for bulk + single) --------
  async function approveSelectedChanges() {
    if (selectedChanges.length === 0) return;
    try {
      setLoadingChanges(true);
      setChangeMsg(null);
      for (const id of selectedChanges) {
        await apiFetch(`/api/admin/profile-change-requests/${id}/approve`, { method: 'POST' });
      }
      setChanges(arr => arr.filter(c => !selectedChanges.includes(c.id)));
      setSelectedChanges([]);
      setChangeMsg({ type: 'success', text: 'Approved selected change requests.' });
    } catch (e: any) {
      setChangeMsg({ type: 'error', text: e?.message || 'Failed to approve selected changes' });
    } finally {
      setLoadingChanges(false);
    }
  }
  async function rejectSelectedChanges() {
    if (selectedChanges.length === 0) return;
    try {
      setLoadingChanges(true);
      setChangeMsg(null);
      for (const id of selectedChanges) {
        await apiFetch(`/api/admin/profile-change-requests/${id}/reject`, { method: 'POST' });
      }
      setChanges(arr => arr.filter(c => !selectedChanges.includes(c.id)));
      setSelectedChanges([]);
      setChangeMsg({ type: 'success', text: 'Rejected selected change requests.' });
    } catch (e: any) {
      setChangeMsg({ type: 'error', text: e?.message || 'Failed to reject selected changes' });
    } finally {
      setLoadingChanges(false);
    }
  }
  async function approveChange(id: number) {
    try {
      setLoadingChanges(true);
      await apiFetch(`/api/admin/profile-change-requests/${id}/approve`, { method: 'POST' });
      setChanges(arr => arr.filter(c => c.id !== id));
      setSelectedChanges(prev => prev.filter(x => x !== id));
      setChangeMsg({ type: 'success', text: 'Change approved.' });
    } catch (e: any) {
      setChangeMsg({ type: 'error', text: e?.message || 'Failed to approve change' });
    } finally {
      setLoadingChanges(false);
    }
  }
  async function rejectChange(id: number) {
    try {
      setLoadingChanges(true);
      await apiFetch(`/api/admin/profile-change-requests/${id}/reject`, { method: 'POST' });
      setChanges(arr => arr.filter(c => c.id !== id));
      setSelectedChanges(prev => prev.filter(x => x !== id));
      setChangeMsg({ type: 'success', text: 'Change rejected.' });
    } catch (e: any) {
      setChangeMsg({ type: 'error', text: e?.message || 'Failed to reject change' });
    } finally {
      setLoadingChanges(false);
    }
  }

  // -------- Actions: People requests (per-id loop for bulk + single) --------
  async function approveSelectedPeopleReqs() {
    if (selectedPeopleReqs.length === 0) return;
    try {
      setLoadingPeople(true);
      setPeopleMsg(null);
      for (const id of selectedPeopleReqs) {
        await apiFetch(`/api/admin/people/requests/${id}/approve`, { method: 'POST' });
      }
      setPeopleReqs(arr => arr.filter(r => !selectedPeopleReqs.includes(r.id)));
      setSelectedPeopleReqs([]);
      setPeopleMsg({ type: 'success', text: 'Approved selected people requests.' });
    } catch (e: any) {
      setPeopleMsg({ type: 'error', text: e?.message || 'Failed to approve selected requests' });
    } finally {
      setLoadingPeople(false);
    }
  }
  async function rejectSelectedPeopleReqs() {
    if (selectedPeopleReqs.length === 0) return;
    try {
      setLoadingPeople(true);
      setPeopleMsg(null);
      for (const id of selectedPeopleReqs) {
        await apiFetch(`/api/admin/people/requests/${id}/reject`, { method: 'POST' });
      }
      setPeopleReqs(arr => arr.filter(r => !selectedPeopleReqs.includes(r.id)));
      setSelectedPeopleReqs([]);
      setPeopleMsg({ type: 'success', text: 'Rejected selected people requests.' });
    } catch (e: any) {
      setPeopleMsg({ type: 'error', text: e?.message || 'Failed to reject selected requests' });
    } finally {
      setLoadingPeople(false);
    }
  }
  async function approvePeopleReq(id: number) {
    try {
      setLoadingPeople(true);
      await apiFetch(`/api/admin/people/requests/${id}/approve`, { method: 'POST' });
      setPeopleReqs(arr => arr.filter(r => r.id !== id));
      setSelectedPeopleReqs(prev => prev.filter(x => x !== id));
      setPeopleMsg({ type: 'success', text: 'People request approved.' });
    } catch (e: any) {
      setPeopleMsg({ type: 'error', text: e?.message || 'Failed to approve people request' });
    } finally {
      setLoadingPeople(false);
    }
  }
  async function rejectPeopleReq(id: number) {
    try {
      setLoadingPeople(true);
      await apiFetch(`/api/admin/people/requests/${id}/reject`, { method: 'POST' });
      setPeopleReqs(arr => arr.filter(r => r.id !== id));
      setSelectedPeopleReqs(prev => prev.filter(x => x !== id));
      setPeopleMsg({ type: 'success', text: 'People request rejected.' });
    } catch (e: any) {
      setPeopleMsg({ type: 'error', text: e?.message || 'Failed to reject people request' });
    } finally {
      setLoadingPeople(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1150, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Admin Dashboard
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button href="/admin/dues" variant="outlined" size="small">
            Dues Tracking &rarr;
          </Button>
          <Button href="/admin/store" variant="outlined" size="small">
            Store Management &rarr;
          </Button>
          <Button href="/admin/users" variant="outlined" size="small">
            User Management &rarr;
          </Button>
        </Stack>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Pending signups" />
        <Tab label="Profile modifications" />
        <Tab label="People requests" />
      </Tabs>

      {/* ---------- PENDING SIGNUPS ---------- */}
      {tab === 0 && (
        <Box className="card" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>Pending signups</Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>Approve or reject new account requests</Typography>
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={selectedSignups.length === 0 || loadingSignups}
                  onClick={approveSelectedSignups}
                >
                  Approve Selected ({selectedSignups.length})
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={selectedSignups.length === 0 || loadingSignups}
                  onClick={rejectSelectedSignups}
                >
                  Reject Selected ({selectedSignups.length})
                </Button>
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">Rows:</Typography>
                <FormControl size="small">
                  <InputLabel id="rows-per-page-signups">Rows per page</InputLabel>
                  <Select
                    labelId="rows-per-page-signups"
                    value={rowsPerPageSignups}
                    label="Rows per page"
                    onChange={(e) => {
                      setRowsPerPageSignups(Number(e.target.value));
                      setPageSignups(0);
                    }}
                  >
                    {PAGE_SIZES.map(sz => (
                      <MenuItem key={sz} value={sz}>{sz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Toolbar>

            {signupMsg && <Alert severity={signupMsg.type === 'info' ? 'info' : signupMsg.type} sx={{ mb: 2 }}>{signupMsg.text}</Alert>}

            {loadingSignups ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={isSomeSignupsOnPage}
                            checked={isAllSignupsOnPage}
                            onChange={toggleAllSignupsOnPage}
                          />
                        </TableCell>
                        <TableCell>Username</TableCell>
                        <TableCell>Display Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Requested At</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedSignups.map((s) => {
                        const isSelected = selectedSignups.includes(s.id);
                        return (
                          <TableRow key={s.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => toggleSignup(s.id)} />
                            </TableCell>
                            <TableCell>@{s.username}</TableCell>
                            <TableCell>{s.displayName || '—'}</TableCell>
                            <TableCell>
                              {s.email ? (
                                <Link href={`mailto:${s.email}`} target="_blank" rel="noreferrer">{s.email}</Link>
                              ) : '—'}
                            </TableCell>
                            <TableCell>{new Date(s.requestedAt).toLocaleString()}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button size="small" variant="contained" onClick={() => approveSignup(s.id)}>Approve</Button>
                                <Button size="small" variant="outlined" color="error" onClick={() => rejectSignup(s.id)}>Reject</Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedSignups.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">No pending signups 🎉</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={sortedSignups.length}
                  page={pageSignups}
                  onPageChange={(_, p) => setPageSignups(p)}
                  rowsPerPage={rowsPerPageSignups}
                  rowsPerPageOptions={PAGE_SIZES}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPageSignups(parseInt(e.target.value, 10));
                    setPageSignups(0);
                  }}
                />
              </>
            )}
        </Box>
      )}

      {/* ---------- PROFILE MODIFICATIONS ---------- */}
      {tab === 1 && (
        <Box className="card" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>Pending profile change requests</Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>Approve or reject requested profile updates</Typography>
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={selectedChanges.length === 0 || loadingChanges}
                  onClick={approveSelectedChanges}
                >
                  Approve Selected ({selectedChanges.length})
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={selectedChanges.length === 0 || loadingChanges}
                  onClick={rejectSelectedChanges}
                >
                  Reject Selected ({selectedChanges.length})
                </Button>
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">Rows:</Typography>
                <FormControl size="small">
                  <InputLabel id="rows-per-page-changes">Rows per page</InputLabel>
                  <Select
                    labelId="rows-per-page-changes"
                    value={rowsPerPageChanges}
                    label="Rows per page"
                    onChange={(e) => {
                      setRowsPerPageChanges(Number(e.target.value));
                      setPageChanges(0);
                    }}
                  >
                    {PAGE_SIZES.map(sz => (
                      <MenuItem key={sz} value={sz}>{sz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Toolbar>

            {changeMsg && <Alert severity={changeMsg.type === 'info' ? 'info' : changeMsg.type} sx={{ mb: 2 }}>{changeMsg.text}</Alert>}

            {loadingChanges ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={isSomeChangesOnPage}
                            checked={isAllChangesOnPage}
                            onChange={toggleAllChangesOnPage}
                          />
                        </TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Field</TableCell>
                        <TableCell>Previous</TableCell>
                        <TableCell>New</TableCell>
                        <TableCell>Requested At</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedChanges.map((c) => {
                        const isSelected = selectedChanges.includes(c.id);
                        return (
                          <TableRow key={c.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => toggleChange(c.id)} />
                            </TableCell>
                            <TableCell>{c.username} ({c.displayName})</TableCell>
                            <TableCell>{c.field}</TableCell>
                            <TableCell>{c.oldValue ?? '—'}</TableCell>
                            <TableCell>{c.newValue}</TableCell>
                            <TableCell>{new Date(c.requestedAt).toLocaleString()}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button size="small" variant="contained" onClick={() => approveChange(c.id)}>Approve</Button>
                                <Button size="small" variant="outlined" color="error" onClick={() => rejectChange(c.id)}>Reject</Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedChanges.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">No pending profile changes 🎉</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={sortedChanges.length}
                  page={pageChanges}
                  onPageChange={(_, p) => setPageChanges(p)}
                  rowsPerPage={rowsPerPageChanges}
                  rowsPerPageOptions={PAGE_SIZES}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPageChanges(parseInt(e.target.value, 10));
                    setPageChanges(0);
                  }}
                />
              </>
            )}
        </Box>
      )}

      {/* ---------- PEOPLE REQUESTS ---------- */}
      {tab === 2 && (
        <Box className="card" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>People requests</Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>Approve or reject user-submitted people add/update requests</Typography>
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  disabled={selectedPeopleReqs.length === 0 || loadingPeople}
                  onClick={approveSelectedPeopleReqs}
                >
                  Approve Selected ({selectedPeopleReqs.length})
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={selectedPeopleReqs.length === 0 || loadingPeople}
                  onClick={rejectSelectedPeopleReqs}
                >
                  Reject Selected ({selectedPeopleReqs.length})
                </Button>
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary">Rows:</Typography>
                <FormControl size="small">
                  <InputLabel id="rows-per-page-people">Rows per page</InputLabel>
                  <Select
                    labelId="rows-per-page-people"
                    value={rowsPerPagePeople}
                    label="Rows per page"
                    onChange={(e) => {
                      setRowsPerPagePeople(Number(e.target.value));
                      setPagePeople(0);
                    }}
                  >
                    {PAGE_SIZES.map(sz => (
                      <MenuItem key={sz} value={sz}>{sz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Toolbar>

            {peopleMsg && <Alert severity={peopleMsg.type === 'info' ? 'info' : peopleMsg.type} sx={{ mb: 2 }}>{peopleMsg.text}</Alert>}

            {loadingPeople ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={isSomePeopleOnPage}
                            checked={isAllPeopleOnPage}
                            onChange={toggleAllPeopleOnPage}
                          />
                        </TableCell>
                        <TableCell>Requester</TableCell>
                        <TableCell>Person</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Relationship</TableCell>
                        <TableCell>Requested At</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedPeopleReqs.map((r) => {
                        const isSelected = selectedPeopleReqs.includes(r.id);
                        return (
                          <TableRow key={r.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => togglePeopleReq(r.id)} />
                            </TableCell>
                            <TableCell>{r.requesterDisplayName || r.userId}</TableCell>
                            <TableCell>
                              {r.action === 'LINK_CHILD'
                                ? `Link #${r.targetPersonId}`
                                : `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim()}
                              {r.action === 'UPDATE' && r.targetPersonId ? ` (update #${r.targetPersonId})` : ''}
                            </TableCell>
                            <TableCell>{r.action === 'LINK_CHILD' ? 'LINK CHILD' : r.action}</TableCell>
                            <TableCell>
                              {r.parentDisplayName
                                ? <>Child of <strong>{r.parentDisplayName}</strong>{r.relation ? ` (${r.relation.replaceAll('_', ' ')})` : ''}</>
                                : r.relation ? r.relation.replaceAll('_', ' ') : '—'}
                            </TableCell>
                            <TableCell>{new Date(r.requestedAt).toLocaleString()}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button size="small" variant="contained" onClick={() => approvePeopleReq(r.id)}>Approve</Button>
                                <Button size="small" variant="outlined" color="error" onClick={() => rejectPeopleReq(r.id)}>Reject</Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedPeopleReqs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Typography color="text.secondary">No pending people requests 🎉</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={sortedPeopleReqs.length}
                  page={pagePeople}
                  onPageChange={(_, p) => setPagePeople(p)}
                  rowsPerPage={rowsPerPagePeople}
                  rowsPerPageOptions={PAGE_SIZES}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPagePeople(parseInt(e.target.value, 10));
                    setPagePeople(0);
                  }}
                />
              </>
            )}
        </Box>
      )}
    </Box>
  );
}
