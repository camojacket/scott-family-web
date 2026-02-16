'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Stack, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress, Tooltip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { apiFetch } from '../../lib/api';
import type { FamilyArtifactDto } from '../../lib/types';

type SortDir = 'asc' | 'desc';

export default function FamilyArtifactsClient({ initialData }: { initialData?: FamilyArtifactDto[] }) {
  const [artifacts, setArtifacts] = useState<FamilyArtifactDto[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Sort state
  const [sortDateDir, setSortDateDir] = useState<SortDir>('desc');
  const [sortNameDir, setSortNameDir] = useState<SortDir>('asc');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Reupload dialog
  const [reuploadId, setReuploadId] = useState<number | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadSubmitting, setReuploadSubmitting] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check admin role
  useEffect(() => {
    const raw = localStorage.getItem('profile');
    if (raw) {
      try {
        const p = JSON.parse(raw);
        const role: string = p?.userRole || '';
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      } catch { /* ignore */ }
    }
  }, []);

  // Sort function
  const sortArtifacts = useCallback((list: FamilyArtifactDto[]) => {
    return [...list].sort((a, b) => {
      const dateA = a.issueDate || '';
      const dateB = b.issueDate || '';
      const dateCmp = dateA.localeCompare(dateB) * (sortDateDir === 'desc' ? -1 : 1);
      if (dateCmp !== 0) return dateCmp;
      return a.name.localeCompare(b.name) * (sortNameDir === 'desc' ? -1 : 1);
    });
  }, [sortDateDir, sortNameDir]);

  // Load artifacts
  const loadArtifacts = useCallback(async () => {
    try {
      const data = await apiFetch<FamilyArtifactDto[]>('/api/family-artifacts');
      setArtifacts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load family artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!initialData) loadArtifacts(); }, [loadArtifacts, initialData]);

  const sorted = sortArtifacts(artifacts);

  // ── Create / Edit ──

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormDate('');
    setFormFile(null);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(artifact: FamilyArtifactDto) {
    setEditingId(artifact.id);
    setFormName(artifact.name);
    setFormDate(artifact.issueDate);
    setFormFile(null);
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formName.trim()) { setFormError('Name is required'); return; }
    if (!formDate) { setFormError('Date is required'); return; }

    setSubmitting(true);
    setFormError('');

    try {
      if (editingId) {
        await apiFetch<FamilyArtifactDto>(`/api/family-artifacts/${editingId}`, {
          method: 'PUT',
          body: { name: formName.trim(), issueDate: formDate },
        });
      } else {
        if (!formFile) { setFormError('File is required'); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append('file', formFile);
        fd.append('name', formName.trim());
        fd.append('issueDate', formDate);
        await apiFetch<FamilyArtifactDto>('/api/family-artifacts', { method: 'POST', body: fd });
      }
      setDialogOpen(false);
      await loadArtifacts();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Re-upload ──

  async function handleReupload() {
    if (!reuploadFile || !reuploadId) return;
    setReuploadSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', reuploadFile);
      await apiFetch<FamilyArtifactDto>(`/api/family-artifacts/${reuploadId}/reupload`, { method: 'POST', body: fd });
      setReuploadId(null);
      setReuploadFile(null);
      await loadArtifacts();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Re-upload failed');
    } finally {
      setReuploadSubmitting(false);
    }
  }

  // ── Delete ──

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/family-artifacts/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      await loadArtifacts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // ── Sort toggle helpers ──

  function toggleDateSort() {
    setSortDateDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  }
  function toggleNameSort() {
    setSortNameDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  function SortIcon({ dir }: { dir: SortDir }) {
    return dir === 'asc'
      ? <ArrowUpwardIcon sx={{ fontSize: 16, ml: 0.5 }} />
      : <ArrowDownwardIcon sx={{ fontSize: 16, ml: 0.5 }} />;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
            Family Artifacts
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Historical documents, census records &amp; family treasures
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ textTransform: 'none' }}>
            Add Artifact
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Sort controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Sort by:</Typography>
        <Button size="small" variant="text" onClick={toggleDateSort}
          sx={{ textTransform: 'none', color: 'var(--foreground)', fontWeight: 600 }}>
          Date <SortIcon dir={sortDateDir} />
        </Button>
        <Button size="small" variant="text" onClick={toggleNameSort}
          sx={{ textTransform: 'none', color: 'var(--foreground)', fontWeight: 600 }}>
          Name <SortIcon dir={sortNameDir} />
        </Button>
      </Box>

      {/* Artifact list */}
      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 6 }}>
          No family artifacts yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {sorted.map((artifact) => (
            <Box
              key={artifact.id}
              className="card card-interactive"
              sx={{
                p: 2, px: 2.5,
                display: 'flex', alignItems: 'center', gap: 2,
              }}
            >
              {/* Clickable area — opens document */}
              <Box
                component="a"
                href={artifact.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2, flex: 1,
                  textDecoration: 'none', color: 'inherit', minWidth: 0,
                }}
              >
                <DescriptionIcon sx={{ color: 'var(--color-primary-400)', fontSize: 28, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.95rem' }} noWrap>
                    {artifact.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    {formatDate(artifact.issueDate)}
                  </Typography>
                </Box>
                <OpenInNewIcon sx={{ color: 'var(--color-gray-400)', fontSize: 18, flexShrink: 0 }} />
              </Box>

              {/* Admin actions */}
              {isAdmin && (
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="Edit name / date">
                    <IconButton size="small" onClick={() => openEdit(artifact)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Re-upload file">
                    <IconButton size="small" onClick={() => { setReuploadId(artifact.id); setReuploadFile(null); }}>
                      <UploadFileIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteId(artifact.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Artifact' : 'Add Family Artifact'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            placeholder="e.g. Sarah Scott — 1880 Federal Census"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Date"
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {!editingId && (
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}
              sx={{ textTransform: 'none' }}>
              {formFile ? formFile.name : 'Choose File (PDF or Image)'}
              <input type="file" hidden accept="application/pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFormFile(f);
                  if (f && !formName.trim()) {
                    setFormName(f.name.replace(/\.[^.]+$/, ''));
                  }
                }} />
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : editingId ? 'Save' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Re-upload Dialog ── */}
      <Dialog open={reuploadId !== null} onClose={() => setReuploadId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Re-upload File</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}
            sx={{ textTransform: 'none' }}>
            {reuploadFile ? reuploadFile.name : 'Choose File (PDF or Image)'}
            <input type="file" hidden accept="application/pdf,image/*"
              onChange={(e) => setReuploadFile(e.target.files?.[0] ?? null)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReuploadId(null)} disabled={reuploadSubmitting}>Cancel</Button>
          <Button variant="contained" onClick={handleReupload}
            disabled={reuploadSubmitting || !reuploadFile}>
            {reuploadSubmitting ? <CircularProgress size={20} /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Family Artifact?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently delete this artifact and its file. This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Format an ISO date string (yyyy-MM-dd) as a readable date */
function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}
