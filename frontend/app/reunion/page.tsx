'use client';

import {
  Box, Typography, Button, Stack, IconButton, TextField, Snackbar, Alert,
  CircularProgress, Select, MenuItem, FormControl, InputLabel, Divider,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import GroupIcon from '@mui/icons-material/Group';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PeopleIcon from '@mui/icons-material/People';
import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE, apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { RsvpDto, RsvpSummary } from '../lib/types';

export default function Page() {
  const { family } = useFamilyName();
  const [reunionNumber, setReunionNumber] = useState('94');
  const [location, setLocation] = useState('Ludowici, GA \u2014 The Broadlevel');
  const [hostedBy, setHostedBy] = useState('Mr. Marcus Scott IV Family');
  const [infoPacketUrl, setInfoPacketUrl] = useState('https://scottphillipsfamily.wordpress.com/wp-content/uploads/2022/12/scott-phillips-2023.pdf');
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [uploadingPacket, setUploadingPacket] = useState(false);
  const packetInputRef = useRef<HTMLInputElement>(null);

  // ── RSVP state ──
  const [rsvpLoaded, setRsvpLoaded] = useState(false);
  const [attending, setAttending] = useState<string>('');  // '', 'yes', 'no'
  const [extraGuests, setExtraGuests] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [hasExistingRsvp, setHasExistingRsvp] = useState(false);

  // ── Admin RSVP state ──
  const [allRsvps, setAllRsvps] = useState<RsvpDto[]>([]);
  const [summary, setSummary] = useState<RsvpSummary | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // ── Load settings + RSVP ──
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.ok ? r.json() : null)
      .then((s: Record<string, string> | null) => {
        if (s?.reunion_number) setReunionNumber(s.reunion_number);
        if (s?.reunion_location) setLocation(s.reunion_location);
        if (s?.reunion_hosted_by) setHostedBy(s.reunion_hosted_by);
        if (s?.reunion_info_packet_url) setInfoPacketUrl(s.reunion_info_packet_url);
      })
      .catch(() => {});

    let admin = false;
    try {
      const p = JSON.parse(localStorage.getItem('profile') || '{}');
      const role: string = p?.userRole || '';
      admin = role === 'ROLE_ADMIN' || role === 'ADMIN';
      setIsAdmin(admin);
    } catch { /* ignore */ }

    // Load user RSVP
    apiFetch<RsvpDto>('/api/rsvp')
      .then((rsvp) => {
        setAttending(rsvp.attending ? 'yes' : 'no');
        setExtraGuests(rsvp.extraGuests || 0);
        setNotes(rsvp.notes || '');
        setHasExistingRsvp(true);
        setRsvpLoaded(true);
      })
      .catch((err) => {
        // 204 = no RSVP yet, which is fine
        if (err?.status !== 204) {
          // real error, but don't block page
        }
        setRsvpLoaded(true);
      });

    // Admin: load summary + all RSVPs
    if (admin) {
      loadAdminData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAdminData = useCallback(() => {
    apiFetch<RsvpSummary>('/api/rsvp/summary').then(setSummary).catch(() => {});
    apiFetch<RsvpDto[]>('/api/rsvp/all').then(setAllRsvps).catch(() => {});
  }, []);

  // ── Settings save (unchanged pattern) ──
  const handleSave = async (key: string, setter: (v: string) => void, label: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: draft }),
      });
      if (!res.ok) throw new Error();
      setter(draft);
      setEditing(null);
      setSnack({ msg: `${label} saved`, severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to save', severity: 'error' });
    }
  };

  const handlePacketUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setSnack({ msg: 'Only PDF files are accepted', severity: 'error' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSnack({ msg: 'File too large. Max 20 MB', severity: 'error' });
      return;
    }
    setUploadingPacket(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/settings/info-packet`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      const data = await res.json();
      setInfoPacketUrl(data.cdnUrl);
      setSnack({ msg: 'Information Packet updated', severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to upload packet', severity: 'error' });
    } finally {
      setUploadingPacket(false);
      // Reset input so re-selecting the same file triggers onChange
      if (packetInputRef.current) packetInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Hero banner */}
      <Box
        className="card"
        sx={{
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 50%, #42a5f5 100%)',
          color: '#fff',
          textAlign: 'center',
          p: { xs: 4, sm: 6 },
          mb: 4,
        }}
      >
        <CelebrationIcon sx={{ fontSize: 48, mb: 2, opacity: 0.9 }} />
        {editing === 'reunion_number' ? (
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 1 }}>
            <TextField
              size="small"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              sx={{
                width: 80,
                input: { color: '#fff', fontSize: '1.5rem', fontWeight: 800, textAlign: 'center' },
                '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.5)' } },
              }}
            />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              th Annual Reunion
            </Typography>
            <Button size="small" variant="contained" onClick={() => handleSave('reunion_number', setReunionNumber, 'Reunion number')} sx={{ ml: 1 }}>Save</Button>
            <Button size="small" variant="text" onClick={() => setEditing(null)} sx={{ color: '#fff' }}>Cancel</Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              {reunionNumber}th Annual Reunion
            </Typography>
            {isAdmin && (
              <IconButton
                size="small"
                onClick={() => { setDraft(reunionNumber); setEditing('reunion_number'); }}
                sx={{ color: '#fff' }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        )}
        <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.9, mb: 1 }}>
          {family}
        </Typography>
      </Box>

      {/* Details card */}
      <Box className="card" sx={{ p: { xs: 3, sm: 5 }, mb: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LocationOnIcon sx={{ color: 'var(--color-primary-500)' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                Location
              </Typography>
              {editing === 'reunion_location' ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" value={draft} onChange={(e) => setDraft(e.target.value)} sx={{ flex: 1 }} />
                  <Button size="small" variant="contained" onClick={() => handleSave('reunion_location', setLocation, 'Location')}>Save</Button>
                  <Button size="small" onClick={() => setEditing(null)}>Cancel</Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography sx={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {location}
                  </Typography>
                  {isAdmin && (
                    <IconButton size="small" onClick={() => { setDraft(location); setEditing('reunion_location'); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <HowToRegIcon sx={{ color: 'var(--color-primary-500)' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                Hosted by
              </Typography>
              {editing === 'reunion_hosted_by' ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" value={draft} onChange={(e) => setDraft(e.target.value)} sx={{ flex: 1 }} />
                  <Button size="small" variant="contained" onClick={() => handleSave('reunion_hosted_by', setHostedBy, 'Hosted by')}>Save</Button>
                  <Button size="small" onClick={() => setEditing(null)}>Cancel</Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography sx={{ fontWeight: 600, color: 'var(--foreground)' }}>
                    {hostedBy}
                  </Typography>
                  {isAdmin && (
                    <IconButton size="small" onClick={() => { setDraft(hostedBy); setEditing('reunion_hosted_by'); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* CTA: Info Packet */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 380 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<DescriptionIcon />}
            href={infoPacketUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              bgcolor: 'var(--color-primary-500)',
              '&:hover': { bgcolor: 'var(--color-primary-600)' },
              py: 1.5,
            }}
          >
            Information Packet
          </Button>
          {isAdmin && (
            <>
              <input
                ref={packetInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={handlePacketUpload}
              />
              <Button
                size="small"
                variant="text"
                startIcon={uploadingPacket ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                disabled={uploadingPacket}
                onClick={() => packetInputRef.current?.click()}
                sx={{ color: 'var(--text-secondary)', textTransform: 'none' }}
              >
                {uploadingPacket ? 'Uploading\u2026' : 'Replace PDF'}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* ── RSVP Section ── */}
      <Box className="card" sx={{ p: { xs: 3, sm: 5 }, mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <HowToRegIcon sx={{ color: 'var(--color-primary-500)', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Will You Be Attending?
          </Typography>
        </Stack>

        {!rsvpLoaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Attending dropdown */}
            <FormControl fullWidth size="small">
              <InputLabel id="attending-label">Attending</InputLabel>
              <Select
                labelId="attending-label"
                label="Attending"
                value={attending}
                onChange={(e) => setAttending(e.target.value)}
              >
                <MenuItem value="">
                  <em>Select one</em>
                </MenuItem>
                <MenuItem value="yes">Yes, I will be attending</MenuItem>
                <MenuItem value="no">No, I will not be attending</MenuItem>
              </Select>
            </FormControl>

            {/* Extra guests (only if attending) */}
            {attending === 'yes' && (
              <FormControl fullWidth size="small">
                <InputLabel id="guests-label">Additional Guests</InputLabel>
                <Select
                  labelId="guests-label"
                  label="Additional Guests"
                  value={extraGuests}
                  onChange={(e) => setExtraGuests(Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n === 0 ? 'Just me' : `+${n} guest${n > 1 ? 's' : ''}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Optional notes */}
            <TextField
              label="Notes (optional)"
              placeholder="e.g., Bringing spouse and 2 kids"
              size="small"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              inputProps={{ maxLength: 500 }}
            />

            {/* Submit */}
            <Button
              variant="contained"
              size="large"
              disabled={!attending || rsvpSaving}
              startIcon={rsvpSaving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <CheckCircleIcon />}
              onClick={async () => {
                setRsvpSaving(true);
                try {
                  await apiFetch('/api/rsvp', {
                    method: 'PUT',
                    body: {
                      attending: attending === 'yes',
                      extraGuests: attending === 'yes' ? extraGuests : 0,
                      notes: notes || null,
                    },
                  });
                  setHasExistingRsvp(true);
                  setSnack({ msg: 'RSVP saved!', severity: 'success' });
                  if (isAdmin) loadAdminData();
                } catch {
                  setSnack({ msg: 'Failed to save RSVP', severity: 'error' });
                } finally {
                  setRsvpSaving(false);
                }
              }}
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
                py: 1.5,
              }}
            >
              {hasExistingRsvp ? 'Update RSVP' : 'Submit RSVP'}
            </Button>

            {hasExistingRsvp && (
              <Alert severity="info" variant="outlined" sx={{ mt: -1 }}>
                {attending === 'yes' ? (
                  <>
                    You&rsquo;re marked as <strong>attending</strong>
                    {extraGuests > 0 && <> with <strong>{extraGuests}</strong> extra guest{extraGuests > 1 ? 's' : ''}</>}.
                  </>
                ) : attending === 'no' ? (
                  <>You&rsquo;re marked as <strong>not attending</strong>.</>
                ) : null}
                {' '}You can update anytime before the reunion.
              </Alert>
            )}
          </Stack>
        )}
      </Box>

      {/* ── Admin: Attendance Dashboard ── */}
      {isAdmin && summary && (
        <>
          <Divider sx={{ my: 4 }} />

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon /> Attendance Dashboard
          </Typography>

          {/* Summary cards */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-primary-600)' }}>
                {summary.totalAttending}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Attending</Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--color-accent-600)' }}>
                {summary.totalExtraGuests}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Extra Guests</Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#2e7d32' }}>
                {summary.totalHeadcount}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Total Headcount</Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--text-secondary)' }}>
                {summary.totalNotAttending}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Not Attending</Typography>
            </Paper>
          </Stack>

          {/* RSVP list */}
          {allRsvps.length > 0 && (
            <Paper variant="outlined" sx={{ overflow: 'auto', mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Attending</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Extra Guests</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allRsvps.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell>{r.displayName}</TableCell>
                      <TableCell>
                        {r.attending ? (
                          <Chip icon={<CheckCircleIcon />} label="Yes" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip icon={<CancelIcon />} label="No" size="small" color="default" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>{r.attending && r.extraGuests > 0 ? `+${r.extraGuests}` : '\u2014'}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.notes || '\u2014'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Reset button */}
          <Button
            variant="outlined"
            color="error"
            startIcon={<RestartAltIcon />}
            onClick={() => setResetDialogOpen(true)}
            sx={{ textTransform: 'none' }}
          >
            Reset All RSVPs (Post-Reunion)
          </Button>

          <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
            <DialogTitle>Reset All RSVPs?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                This will permanently delete all RSVP responses. This is intended to be used
                after the reunion is over to prepare for next year. This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                onClick={async () => {
                  try {
                    await apiFetch('/api/rsvp/reset', { method: 'POST' });
                    setAllRsvps([]);
                    setSummary({ totalAttending: 0, totalNotAttending: 0, totalExtraGuests: 0, totalHeadcount: 0 });
                    setAttending('');
                    setExtraGuests(0);
                    setNotes('');
                    setHasExistingRsvp(false);
                    setResetDialogOpen(false);
                    setSnack({ msg: 'All RSVPs have been reset', severity: 'success' });
                  } catch {
                    setSnack({ msg: 'Failed to reset RSVPs', severity: 'error' });
                  }
                }}
              >
                Yes, Reset All
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

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