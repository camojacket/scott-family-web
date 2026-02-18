'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/useAuth';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { apiFetch } from '../../lib/api';
import type { AdminUserItem } from '../../lib/types';

type AdminPersonItem = {
  personId: number;
  displayName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  location: string | null;
};

const PAGE_SIZES = [10, 25, 50];

type BanDuration = '1h' | '1d' | '7d' | '30d' | '365d' | 'permanent';

function addDuration(dur: BanDuration): string | null {
  if (dur === 'permanent') return null;
  const now = new Date();
  const hours: Record<string, number> = { '1h': 1, '1d': 24, '7d': 168, '30d': 720, '365d': 8760 };
  now.setTime(now.getTime() + (hours[dur] ?? 24) * 3600_000);
  return now.toISOString();
}

const durationLabels: Record<BanDuration, string> = {
  '1h': '1 Hour',
  '1d': '1 Day',
  '7d': '7 Days',
  '30d': '30 Days',
  '365d': '1 Year',
  'permanent': 'Permanent',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { isAdmin, adminLoading } = useAuth();

  // Redirect non-admins once server verification completes
  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.replace('/');
    }
  }, [adminLoading, isAdmin, router]);

  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminUserItem | null>(null);

  // Ban dialog
  const [banTarget, setBanTarget] = useState<AdminUserItem | null>(null);
  const [banDuration, setBanDuration] = useState<BanDuration>('7d');
  const [banReason, setBanReason] = useState('');

  // Role filter
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');

  // Profiles (people without user accounts)
  const [profiles, setProfiles] = useState<AdminPersonItem[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [profilePage, setProfilePage] = useState(0);
  const [profileRowsPerPage, setProfileRowsPerPage] = useState(PAGE_SIZES[0]);
  const [deleteProfileTarget, setDeleteProfileTarget] = useState<AdminPersonItem | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch<AdminUserItem[]>('/api/admin/users');
      setUsers(data);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function loadProfiles() {
    setLoadingProfiles(true);
    try {
      const data = await apiFetch<AdminPersonItem[]>('/api/admin/users/profiles');
      setProfiles(data);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to load profiles' });
    } finally {
      setLoadingProfiles(false);
    }
  }

  useEffect(() => { if (tab === 1) loadProfiles(); }, [tab]);

  // Filter + paginate
  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter === 'admin') result = result.filter((u) => u.userRole === 'ROLE_ADMIN');
    else if (roleFilter === 'user') result = result.filter((u) => u.userRole !== 'ROLE_ADMIN');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.displayName?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, search, roleFilter]);

  const paged = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Profile filtering/pagination
  const filteredProfiles = useMemo(() => {
    if (!profileSearch.trim()) return profiles;
    const q = profileSearch.toLowerCase();
    return profiles.filter(
      (p) =>
        p.displayName?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
    );
  }, [profiles, profileSearch]);

  const pagedProfiles = useMemo(() => {
    const start = profilePage * profileRowsPerPage;
    return filteredProfiles.slice(start, start + profileRowsPerPage);
  }, [filteredProfiles, profilePage, profileRowsPerPage]);

  // ─── Actions ──────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: `Deleted user "${deleteTarget.username}" and associated data.` });
      setDeleteTarget(null);
      loadUsers();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Delete failed' });
    }
  }

  async function confirmBan() {
    if (!banTarget) return;
    try {
      const bannedUntil = addDuration(banDuration);
      await apiFetch(`/api/admin/users/${banTarget.id}/ban`, {
        method: 'POST',
        body: { bannedUntil, reason: banReason || null },
      });
      setMsg({
        type: 'success',
        text: `Banned "${banTarget.username}" (${durationLabels[banDuration]}).`,
      });
      setBanTarget(null);
      setBanReason('');
      loadUsers();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Ban failed' });
    }
  }

  async function handleUnban(user: AdminUserItem) {
    try {
      await apiFetch(`/api/admin/users/${user.id}/unban`, { method: 'POST' });
      setMsg({ type: 'success', text: `Unbanned "${user.username}".` });
      loadUsers();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Unban failed' });
    }
  }

  async function handleToggleRole(user: AdminUserItem) {
    const newRole = user.userRole === 'ROLE_ADMIN' ? 'ROLE_USER' : 'ROLE_ADMIN';
    const label = newRole === 'ROLE_ADMIN' ? 'Admin' : 'User';
    try {
      await apiFetch(`/api/admin/users/${user.id}/role`, {
        method: 'POST',
        body: { role: newRole },
      });
      setMsg({ type: 'success', text: `Changed "${user.username}" role to ${label}.` });
      loadUsers();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Role change failed' });
    }
  }

  async function confirmDeleteProfile() {
    if (!deleteProfileTarget) return;
    try {
      await apiFetch(`/api/admin/users/person/${deleteProfileTarget.personId}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: `Deleted profile "${deleteProfileTarget.displayName}" and relationship data.` });
      setDeleteProfileTarget(null);
      loadProfiles();
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Delete failed' });
    }
  }

  function isBanned(u: AdminUserItem) {
    if (!u.bannedUntil) return false;
    return new Date(u.bannedUntil) > new Date();
  }

  function isPermanent(u: AdminUserItem) {
    if (!u.bannedUntil) return false;
    return new Date(u.bannedUntil).getFullYear() >= 9999;
  }

  function formatBanUntil(u: AdminUserItem) {
    if (!u.bannedUntil) return '';
    if (isPermanent(u)) return 'Permanent';
    return new Date(u.bannedUntil).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  // ─── Render ───────────────────────────────────────
  if (adminLoading || !isAdmin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
          User Management
        </Typography>
        <Button href="/admin" variant="outlined" size="small">
          &larr; Back to Admin
        </Button>
      </Stack>

      {msg && (
        <Alert severity={msg.type} onClose={() => setMsg(null)} sx={{ mb: 2 }}>
          {msg.text}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`Users (${filtered.length})`} />
        <Tab label={`Profiles without Account (${filteredProfiles.length})`} />
      </Tabs>

      {/* ─── Users Tab ─── */}
      {tab === 0 && (
        <>
          <Toolbar disableGutters sx={{ mb: 1 }}>
            <TextField
              placeholder="Search users…"
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ width: 300 }}
            />
            <FormControl size="small" sx={{ ml: 2, minWidth: 130 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => { setRoleFilter(e.target.value as 'all' | 'admin' | 'user'); setPage(0); }}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="admin">Admins Only</MenuItem>
                <MenuItem value="user">Users Only</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ ml: 2, color: 'var(--text-secondary)' }}>
              {filtered.length} user{filtered.length !== 1 ? 's' : ''}
            </Typography>
          </Toolbar>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer className="card" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Display Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((u) => (
                      <TableRow key={u.id} sx={{ '&:hover': { bgcolor: 'var(--color-primary-50, #f5f3ff)' } }}>
                        <TableCell>{u.username}</TableCell>
                        <TableCell>{u.displayName || '—'}</TableCell>
                        <TableCell>{u.email || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={u.userRole?.replace('ROLE_', '')}
                            size="small"
                            color={u.userRole === 'ROLE_ADMIN' ? 'secondary' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {isBanned(u) ? (
                            <Chip
                              label={isPermanent(u) ? 'Banned (Permanent)' : `Banned until ${formatBanUntil(u)}`}
                              size="small"
                              color="error"
                              title={u.banReason || undefined}
                            />
                          ) : !u.approvedAt ? (
                            <Chip label="Pending" size="small" color="warning" variant="outlined" />
                          ) : (
                            <Chip label="Active" size="small" color="success" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              color={u.userRole === 'ROLE_ADMIN' ? 'inherit' : 'secondary'}
                              onClick={() => handleToggleRole(u)}
                            >
                              {u.userRole === 'ROLE_ADMIN' ? 'Remove Admin' : 'Make Admin'}
                            </Button>
                            {isBanned(u) ? (
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                onClick={() => handleUnban(u)}
                              >
                                Unban
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => { setBanTarget(u); setBanDuration('7d'); setBanReason(''); }}
                                disabled={u.userRole === 'ROLE_ADMIN'}
                              >
                                Ban
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => setDeleteTarget(u)}
                              disabled={u.userRole === 'ROLE_ADMIN'}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paged.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'var(--text-secondary)' }}>
                          {search ? 'No users match your search.' : 'No users found.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={PAGE_SIZES}
              />
            </>
          )}
        </>
      )}

      {/* ─── Profiles Tab ─── */}
      {tab === 1 && (
        <>
          <Toolbar disableGutters sx={{ mb: 1 }}>
            <TextField
              placeholder="Search profiles…"
              size="small"
              value={profileSearch}
              onChange={(e) => { setProfileSearch(e.target.value); setProfilePage(0); }}
              sx={{ width: 300 }}
            />
            <Typography variant="body2" sx={{ ml: 2, color: 'var(--text-secondary)' }}>
              {filteredProfiles.length} profile{filteredProfiles.length !== 1 ? 's' : ''} without an account
            </Typography>
          </Toolbar>

          {loadingProfiles ? (
            <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer className="card" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Display Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date of Birth</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date of Death</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedProfiles.map((p) => (
                      <TableRow key={p.personId} sx={{ '&:hover': { bgcolor: 'var(--color-primary-50, #f5f3ff)' } }}>
                        <TableCell>{p.displayName || '—'}</TableCell>
                        <TableCell>{p.dateOfBirth || '—'}</TableCell>
                        <TableCell>{p.dateOfDeath || '—'}</TableCell>
                        <TableCell>{p.location || '—'}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => setDeleteProfileTarget(p)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagedProfiles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'var(--text-secondary)' }}>
                          {profileSearch ? 'No profiles match your search.' : 'No orphan profiles found.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredProfiles.length}
                page={profilePage}
                onPageChange={(_, p) => setProfilePage(p)}
                rowsPerPage={profileRowsPerPage}
                onRowsPerPageChange={(e) => { setProfileRowsPerPage(parseInt(e.target.value, 10)); setProfilePage(0); }}
                rowsPerPageOptions={PAGE_SIZES}
              />
            </>
          )}
        </>
      )}

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{deleteTarget?.username}</strong>?
            This will remove their account, profile, all blog posts, comments, likes, gallery
            uploads, and relationship data. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Ban Dialog ─── */}
      <Dialog open={!!banTarget} onClose={() => setBanTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ban User</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ban <strong>{banTarget?.username}</strong> from logging in.
          </DialogContentText>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Duration</InputLabel>
              <Select
                value={banDuration}
                label="Duration"
                onChange={(e) => setBanDuration(e.target.value as BanDuration)}
              >
                {Object.entries(durationLabels).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Reason (optional)"
              placeholder="e.g. Inappropriate behavior"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              multiline
              rows={2}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanTarget(null)}>Cancel</Button>
          <Button onClick={confirmBan} color="warning" variant="contained">
            Ban User
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Profile Confirmation Dialog ─── */}
      <Dialog open={!!deleteProfileTarget} onClose={() => setDeleteProfileTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Profile</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete the profile for <strong>{deleteProfileTarget?.displayName}</strong>?
            This will remove the person record and all associated relationship data (parents, siblings, spouses).
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProfileTarget(null)}>Cancel</Button>
          <Button onClick={confirmDeleteProfile} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
