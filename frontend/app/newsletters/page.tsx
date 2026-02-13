'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Stack, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress, Tooltip,
} from '@mui/material';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useFamilyName } from '../lib/FamilyNameContext';
import { apiFetch } from '../lib/api';
import type { NewsletterDto } from '../lib/types';

type SortDir = 'asc' | 'desc';

export default function Page() {
  const { quarterly } = useFamilyName();
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [loading, setLoading] = useState(true);
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
  const sortNewsletters = useCallback((list: NewsletterDto[]) => {
    return [...list].sort((a, b) => {
      const dateA = a.issueDate || '';
      const dateB = b.issueDate || '';
      const dateCmp = dateA.localeCompare(dateB) * (sortDateDir === 'desc' ? -1 : 1);
      if (dateCmp !== 0) return dateCmp;
      return a.name.localeCompare(b.name) * (sortNameDir === 'desc' ? -1 : 1);
    });
  }, [sortDateDir, sortNameDir]);

  // Load newsletters
  const loadNewsletters = useCallback(async () => {
    try {
      const data = await apiFetch<NewsletterDto[]>('/api/newsletters');
      setNewsletters(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load newsletters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNewsletters(); }, [loadNewsletters]);

  const sorted = sortNewsletters(newsletters);

  // ── Create / Edit ──

  function openCreate() {
    setEditingId(null);
    setFormName('');
    setFormDate('');
    setFormFile(null);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(nl: NewsletterDto) {
    setEditingId(nl.id);
    setFormName(nl.name);
    setFormDate(nl.issueDate);
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
        // Update metadata only
        await apiFetch<NewsletterDto>(`/api/newsletters/${editingId}`, {
          method: 'PUT',
          body: { name: formName.trim(), issueDate: formDate },
        });
      } else {
        // Create — file required
        if (!formFile) { setFormError('PDF file is required'); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append('file', formFile);
        fd.append('name', formName.trim());
        fd.append('issueDate', formDate);
        await apiFetch<NewsletterDto>('/api/newsletters', { method: 'POST', body: fd });
      }
      setDialogOpen(false);
      await loadNewsletters();
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
      await apiFetch<NewsletterDto>(`/api/newsletters/${reuploadId}/reupload`, { method: 'POST', body: fd });
      setReuploadId(null);
      setReuploadFile(null);
      await loadNewsletters();
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
      await apiFetch(`/api/newsletters/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      await loadNewsletters();
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
            Newsletters
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Past issues of the <em>{quarterly}</em>
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ textTransform: 'none' }}>
            Add Newsletter
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

      {/* Newsletter list */}
      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 6 }}>
          No newsletters yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {sorted.map((nl) => (
            <Box
              key={nl.id}
              className="card card-interactive"
              sx={{
                p: 2, px: 2.5,
                display: 'flex', alignItems: 'center', gap: 2,
              }}
            >
              {/* Clickable area — opens PDF */}
              <Box
                component="a"
                href={nl.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2, flex: 1,
                  textDecoration: 'none', color: 'inherit', minWidth: 0,
                }}
              >
                <NewspaperIcon sx={{ color: 'var(--color-primary-400)', fontSize: 28, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.95rem' }} noWrap>
                    {nl.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    {formatDate(nl.issueDate)}
                  </Typography>
                </Box>
                <OpenInNewIcon sx={{ color: 'var(--color-gray-400)', fontSize: 18, flexShrink: 0 }} />
              </Box>

              {/* Admin actions */}
              {isAdmin && (
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Tooltip title="Edit name / date">
                    <IconButton size="small" onClick={() => openEdit(nl)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Re-upload PDF">
                    <IconButton size="small" onClick={() => { setReuploadId(nl.id); setReuploadFile(null); }}>
                      <UploadFileIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteId(nl.id)}>
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
        <DialogTitle>{editingId ? 'Edit Newsletter' : 'Add Newsletter'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            placeholder="e.g. Vol 7, Issue 1"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Issue Date"
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
              {formFile ? formFile.name : 'Choose PDF'}
              <input type="file" hidden accept="application/pdf"
                onChange={(e) => setFormFile(e.target.files?.[0] ?? null)} />
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
        <DialogTitle>Re-upload PDF</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}
            sx={{ textTransform: 'none' }}>
            {reuploadFile ? reuploadFile.name : 'Choose PDF'}
            <input type="file" hidden accept="application/pdf"
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
        <DialogTitle>Delete Newsletter?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently delete this newsletter and its PDF. This cannot be undone.</Typography>
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