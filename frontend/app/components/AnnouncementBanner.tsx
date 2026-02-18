'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/useAuth';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CampaignIcon from '@mui/icons-material/Campaign';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { apiFetch } from '../lib/api';
import type { AnnouncementDto } from '../lib/types';

const DISMISSED_KEY = 'dismissed_announcements';

function getDismissed(): number[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setDismissed(ids: number[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [dismissed, setDismissedState] = useState<number[]>([]);
  const [selectedAnn, setSelectedAnn] = useState<AnnouncementDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAdmin } = useAuth();

  // Admin management state
  const [adminOpen, setAdminOpen] = useState(false);
  const [allAnnouncements, setAllAnnouncements] = useState<AnnouncementDto[]>([]);
  const [editAnn, setEditAnn] = useState<AnnouncementDto | null>(null);
  const [formBanner, setFormBanner] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDismissedState(getDismissed());
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const data = await apiFetch<AnnouncementDto[]>('/api/announcements/active');
      setAnnouncements(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);

  const loadAll = useCallback(async () => {
    try {
      const data = await apiFetch<AnnouncementDto[]>('/api/announcements');
      setAllAnnouncements(data);
    } catch { /* silent */ }
  }, []);

  // Filter out dismissed
  const visible = announcements.filter(a => !dismissed.includes(a.id));

  function handleDismiss(id: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    const updated = [...dismissed, id];
    setDismissedState(updated);
    setDismissed(updated);
  }

  function handleBannerClick(ann: AnnouncementDto) {
    setSelectedAnn(ann);
    setDialogOpen(true);
  }

  // ── Admin functions ──

  function openAdminPanel() {
    loadAll();
    setAdminOpen(true);
    resetForm();
  }

  function resetForm() {
    setEditAnn(null);
    setFormBanner('');
    setFormBody('');
    setFormActive(true);
  }

  function startEdit(ann: AnnouncementDto) {
    setEditAnn(ann);
    setFormBanner(ann.bannerText);
    setFormBody(ann.body);
    setFormActive(ann.active);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editAnn) {
        await apiFetch(`/api/announcements/${editAnn.id}`, {
          method: 'PUT',
          body: { bannerText: formBanner, body: formBody, active: formActive },
        });
      } else {
        await apiFetch('/api/announcements', {
          method: 'POST',
          body: { bannerText: formBanner, body: formBody },
        });
      }
      resetForm();
      await loadAll();
      await loadActive();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this announcement?')) return;
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      await loadAll();
      await loadActive();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (visible.length === 0 && !isAdmin) return null;

  return (
    <>
      {/* ── Announcement banners ── */}
      {visible.map(ann => (
        <Box
          key={ann.id}
          onClick={() => handleBannerClick(ann)}
          sx={{
            width: '100%',
            bgcolor: '#fff3cd',
            borderBottom: '1px solid #ffc107',
            px: 2,
            py: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            '&:hover': { bgcolor: '#ffecb3' },
            transition: 'background 0.2s',
          }}
        >
          <CampaignIcon sx={{ color: '#e65100', fontSize: 20 }} />
          <Typography
            variant="body2"
            sx={{
              color: '#663c00',
              fontWeight: 600,
              flex: 1,
              textAlign: 'center',
            }}
          >
            {ann.bannerText}
          </Typography>
          <IconButton
            size="small"
            onClick={e => handleDismiss(ann.id, e)}
            sx={{ color: '#663c00' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      {/* Admin manage button (shown as subtle link below banners) */}
      {isAdmin && (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            py: 0.5,
            bgcolor: visible.length > 0 ? '#fff8e1' : 'transparent',
          }}
        >
          <Button
            size="small"
            startIcon={<CampaignIcon />}
            onClick={openAdminPanel}
            sx={{ fontSize: '0.75rem', color: 'var(--color-primary-500)' }}
          >
            Manage Announcements
          </Button>
        </Box>
      )}

      {/* ── View announcement dialog ── */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedAnn && (
          <>
            <DialogTitle
              sx={{
                fontWeight: 700,
                color: '#e65100',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CampaignIcon />
              {selectedAnn.bannerText}
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Typography
                sx={{
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedAnn.body}
              </Typography>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* ── Admin management dialog ── */}
      <Dialog
        open={adminOpen}
        onClose={() => { setAdminOpen(false); resetForm(); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
          Manage Announcements
        </DialogTitle>
        <DialogContent>
          {/* Form */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              {editAnn ? 'Edit Announcement' : 'Create New Announcement'}
            </Typography>
            <TextField
              fullWidth
              label="Banner Text"
              value={formBanner}
              onChange={e => setFormBanner(e.target.value)}
              sx={{ mb: 2 }}
              size="small"
              helperText="Short text displayed in the yellow banner"
            />
            <TextField
              fullWidth
              label="Body / Details"
              value={formBody}
              onChange={e => setFormBody(e.target.value)}
              multiline
              rows={4}
              sx={{ mb: 2 }}
              size="small"
              helperText="Detailed content shown when the banner is clicked"
            />
            {editAnn && (
              <FormControlLabel
                control={
                  <Switch
                    checked={formActive}
                    onChange={e => setFormActive(e.target.checked)}
                  />
                }
                label="Active"
                sx={{ mb: 1 }}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !formBanner.trim()}
                startIcon={editAnn ? <EditIcon /> : <AddIcon />}
                sx={{
                  bgcolor: 'var(--color-primary-500)',
                  '&:hover': { bgcolor: 'var(--color-primary-600)' },
                }}
              >
                {saving ? 'Saving...' : editAnn ? 'Update' : 'Create'}
              </Button>
              {editAnn && (
                <Button onClick={resetForm} sx={{ color: 'var(--text-secondary)' }}>
                  Cancel Edit
                </Button>
              )}
            </Stack>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Existing announcements */}
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            All Announcements
          </Typography>
          {allAnnouncements.length === 0 && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              No announcements yet.
            </Typography>
          )}
          <Stack spacing={1}>
            {allAnnouncements.map(ann => (
              <Box
                key={ann.id}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: ann.active ? '#fff8e1' : '#f5f5f5',
                  border: '1px solid',
                  borderColor: ann.active ? '#ffc107' : '#e0e0e0',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ann.bannerText}
                      {!ann.active && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ ml: 1, color: '#999' }}
                        >
                          (inactive)
                        </Typography>
                      )}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'var(--text-secondary)', display: 'block', mt: 0.5 }}
                    >
                      {ann.body?.substring(0, 100)}{ann.body?.length > 100 ? '...' : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => startEdit(ann)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(ann.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAdminOpen(false); resetForm(); }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
