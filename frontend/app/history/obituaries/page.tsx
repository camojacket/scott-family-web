'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Stack, Button, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress, Tooltip,
  Chip, InputAdornment, Card, CardMedia, CardContent, CardActions,
  Autocomplete,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';
import LabelIcon from '@mui/icons-material/Label';
import { apiFetch } from '../../lib/api';
import type { ObituaryDto } from '../../lib/types';

type PersonHit = { personId: number; displayName: string };

export default function ObituariesPage() {
  const [obituaries, setObituaries] = useState<ObituaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState('');

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formPersonIds, setFormPersonIds] = useState<PersonHit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Tag editor dialog
  const [tagDialogId, setTagDialogId] = useState<number | null>(null);
  const [tagPersonIds, setTagPersonIds] = useState<PersonHit[]>([]);
  const [tagSubmitting, setTagSubmitting] = useState(false);

  // Reupload dialog
  const [reuploadId, setReuploadId] = useState<number | null>(null);
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadSubmitting, setReuploadSubmitting] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview dialog
  const [previewObit, setPreviewObit] = useState<ObituaryDto | null>(null);

  // Person autocomplete
  const [personInput, setPersonInput] = useState('');
  const [personOptions, setPersonOptions] = useState<PersonHit[]>([]);
  const [personLoading, setPersonLoading] = useState(false);

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

  const loadObituaries = useCallback(async () => {
    try {
      const data = await apiFetch<ObituaryDto[]>('/api/obituaries');
      setObituaries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load obituaries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadObituaries(); }, [loadObituaries]);

  // Person search for tagging
  useEffect(() => {
    if (!personInput.trim()) { setPersonOptions([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setPersonLoading(true);
        const data = await apiFetch<PersonHit[]>(`/api/people/search?q=${encodeURIComponent(personInput)}&limit=15`);
        if (!cancelled) setPersonOptions(data || []);
      } catch {
        if (!cancelled) setPersonOptions([]);
      } finally {
        if (!cancelled) setPersonLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [personInput]);

  // Filter obituaries by search
  const filtered = useMemo(() => {
    if (!search.trim()) return obituaries;
    const q = search.toLowerCase();
    return obituaries.filter(o =>
      o.title.toLowerCase().includes(q) ||
      o.taggedPeople.some(p => p.displayName.toLowerCase().includes(q))
    );
  }, [obituaries, search]);

  // ── Create ──
  function openCreate() {
    setEditingId(null);
    setFormTitle('');
    setFormFile(null);
    setFormPersonIds([]);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(obit: ObituaryDto) {
    setEditingId(obit.id);
    setFormTitle(obit.title);
    setFormFile(null);
    setFormPersonIds([]);
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formTitle.trim()) { setFormError('Title is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      if (editingId) {
        await apiFetch<ObituaryDto>(`/api/obituaries/${editingId}`, {
          method: 'PUT',
          body: { title: formTitle.trim() },
        });
      } else {
        if (!formFile) { setFormError('File is required'); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append('file', formFile);
        fd.append('title', formTitle.trim());
        if (formPersonIds.length > 0) {
          fd.append('personIds', JSON.stringify(formPersonIds.map(p => p.personId)));
        }
        await apiFetch<ObituaryDto>('/api/obituaries', { method: 'POST', body: fd });
      }
      setDialogOpen(false);
      await loadObituaries();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Tag editor ──
  function openTagEditor(obit: ObituaryDto) {
    setTagDialogId(obit.id);
    setTagPersonIds(obit.taggedPeople.map(p => ({ personId: p.personId, displayName: p.displayName })));
  }

  async function handleTagSave() {
    if (!tagDialogId) return;
    setTagSubmitting(true);
    try {
      await apiFetch<ObituaryDto>(`/api/obituaries/${tagDialogId}/tags`, {
        method: 'PUT',
        body: tagPersonIds.map(p => p.personId),
      });
      setTagDialogId(null);
      await loadObituaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tag update failed');
    } finally {
      setTagSubmitting(false);
    }
  }

  // ── Reupload ──
  async function handleReupload() {
    if (!reuploadFile || !reuploadId) return;
    setReuploadSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', reuploadFile);
      await apiFetch<ObituaryDto>(`/api/obituaries/${reuploadId}/reupload`, { method: 'POST', body: fd });
      setReuploadId(null);
      setReuploadFile(null);
      await loadObituaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Re-upload failed');
    } finally {
      setReuploadSubmitting(false);
    }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/obituaries/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      await loadObituaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  // Shared person autocomplete component
  function PersonTagAutocomplete({
    value,
    onChange,
  }: {
    value: PersonHit[];
    onChange: (v: PersonHit[]) => void;
  }) {
    return (
      <Autocomplete
        multiple
        options={personOptions}
        getOptionLabel={(o) => o.displayName}
        isOptionEqualToValue={(a, b) => a.personId === b.personId}
        value={value}
        onChange={(_, v) => onChange(v)}
        inputValue={personInput}
        onInputChange={(_, v) => setPersonInput(v)}
        loading={personLoading}
        filterSelectedOptions
        renderInput={(params) => (
          <TextField
            {...params}
            label="Tag People"
            placeholder="Search for family members..."
            size="small"
          />
        )}
        renderTags={(tags, getTagProps) =>
          tags.map((tag, i) => (
            <Chip
              {...getTagProps({ index: i })}
              key={tag.personId}
              label={tag.displayName}
              size="small"
              icon={<PersonIcon />}
              sx={{ bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}
            />
          ))
        }
      />
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: { xs: 3, sm: 5 }, px: { xs: 2, sm: 0 } }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
            Obituaries
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            A treasured collection of family obituaries and memorial programs
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
            sx={{ textTransform: 'none', flexShrink: 0 }}>
            Upload Obituary
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Search bar */}
      <TextField
        placeholder="Search by name or title..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'var(--color-gray-400)' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Obituary cards */}
      {filtered.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 6 }}>
          {search ? 'No obituaries match your search.' : 'No obituaries uploaded yet.'}
        </Typography>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2.5,
        }}>
          {filtered.map((obit) => (
            <Card
              key={obit.id}
              sx={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'box-shadow 200ms, transform 200ms',
                '&:hover': { boxShadow: 'var(--shadow-md)', transform: 'translateY(-2px)' },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Clickable preview area */}
              <Box
                sx={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => {
                  if (obit.fileType === 'IMAGE') {
                    setPreviewObit(obit);
                  } else {
                    window.open(obit.fileUrl, '_blank');
                  }
                }}
              >
                {obit.fileType === 'IMAGE' ? (
                  <CardMedia
                    component="img"
                    image={obit.fileUrl}
                    alt={obit.title}
                    sx={{ height: 200, objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{
                    height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: 'var(--color-gray-50)',
                  }}>
                    <PictureAsPdfIcon sx={{ fontSize: 64, color: 'var(--color-gray-300)' }} />
                  </Box>
                )}
                {/* File type badge */}
                <Chip
                  icon={obit.fileType === 'IMAGE' ? <ImageIcon /> : <PictureAsPdfIcon />}
                  label={obit.fileType}
                  size="small"
                  sx={{
                    position: 'absolute', top: 8, right: 8,
                    bgcolor: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.7rem',
                  }}
                />
              </Box>

              <CardContent sx={{ flex: 1, pb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1, color: 'var(--foreground)' }}>
                  {obit.title}
                </Typography>
                {obit.taggedPeople.length > 0 && (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {obit.taggedPeople.map((p) => (
                      <Chip
                        key={p.personId}
                        label={p.displayName}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.72rem', height: 22,
                          borderColor: 'var(--color-primary-200)',
                          color: 'var(--color-primary-700)',
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </CardContent>

              {/* Admin actions */}
              {isAdmin && (
                <CardActions sx={{ pt: 0, px: 2, pb: 1.5, gap: 0.5 }}>
                  <Tooltip title="Edit title">
                    <IconButton size="small" onClick={() => openEdit(obit)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit tags">
                    <IconButton size="small" onClick={() => openTagEditor(obit)}>
                      <LabelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Re-upload file">
                    <IconButton size="small" onClick={() => { setReuploadId(obit.id); setReuploadFile(null); }}>
                      <UploadFileIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setDeleteId(obit.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              )}

              {/* Non-admin: open link */}
              {!isAdmin && (
                <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
                  <Button
                    size="small"
                    endIcon={<OpenInNewIcon />}
                    onClick={() => {
                      if (obit.fileType === 'IMAGE') {
                        setPreviewObit(obit);
                      } else {
                        window.open(obit.fileUrl, '_blank');
                      }
                    }}
                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                  >
                    View {obit.fileType === 'IMAGE' ? 'Image' : 'PDF'}
                  </Button>
                </CardActions>
              )}
            </Card>
          ))}
        </Box>
      )}

      {/* ── Image Preview Dialog ── */}
      <Dialog
        open={previewObit !== null}
        onClose={() => setPreviewObit(null)}
        maxWidth="lg"
        fullWidth
      >
        {previewObit && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>{previewObit.title}</DialogTitle>
            <DialogContent>
              <Box
                component="img"
                src={previewObit.fileUrl}
                alt={previewObit.title}
                sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              />
              {previewObit.taggedPeople.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mr: 1 }}>
                    Tagged:
                  </Typography>
                  {previewObit.taggedPeople.map((p) => (
                    <Chip key={p.personId} label={p.displayName} size="small" variant="outlined" />
                  ))}
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                href={previewObit.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon />}
              >
                Open Full Size
              </Button>
              <Button onClick={() => setPreviewObit(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Obituary' : 'Upload Obituary'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Title"
            placeholder="e.g. Carrie P. Davis (Obituary Program)"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            fullWidth
            required
          />
          {!editingId && (
            <>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}
                sx={{ textTransform: 'none' }}>
                {formFile ? formFile.name : 'Choose File (PDF or Image)'}
                <input type="file" hidden accept="application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFormFile(f);
                    if (f && !formTitle.trim()) {
                      setFormTitle(f.name.replace(/\.[^.]+$/, ''));
                    }
                  }} />
              </Button>
              <PersonTagAutocomplete value={formPersonIds} onChange={setFormPersonIds} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : editingId ? 'Save' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Tag Editor Dialog ── */}
      <Dialog open={tagDialogId !== null} onClose={() => setTagDialogId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Tagged People</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <PersonTagAutocomplete value={tagPersonIds} onChange={setTagPersonIds} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogId(null)} disabled={tagSubmitting}>Cancel</Button>
          <Button variant="contained" onClick={handleTagSave} disabled={tagSubmitting}>
            {tagSubmitting ? <CircularProgress size={20} /> : 'Save Tags'}
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
        <DialogTitle>Delete Obituary?</DialogTitle>
        <DialogContent>
          <Typography>This will permanently delete this obituary and its file. This cannot be undone.</Typography>
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
