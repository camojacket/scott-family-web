'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, uploadAnonymous } from '../../lib/api';
import PersonAutocomplete from '../../components/PersonAutocomplete';
import ChildrenEditor from '../../components/ChildrenEditor';
import ArticleIcon from '@mui/icons-material/Article';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ImageIcon from '@mui/icons-material/Image';

type Rel = { personId: number; displayName: string; relation: string };
type Profile = {
  personId: number;
  displayName: string;
  bio?: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  deceased?: boolean;
  location?: string;
  profilePictureUrl?: string | null;
  bannerImageUrl?: string | null;
  motherId?: number | null;
  fatherId?: number | null;
  parents: Rel[];
  children: Rel[];
  siblings: Rel[];
  spouses: Rel[];
  hasAccount: boolean;
  username?: string;
  userRole?: string;
  email?: string;
};

function getIsAdmin(): boolean {
  try {
    const raw = localStorage.getItem('profile');
    if (!raw) return false;
    const p = JSON.parse(raw);
    const role = p?.userRole || '';
    return role === 'ROLE_ADMIN' || role === 'ADMIN';
  } catch { return false; }
}

function getIsLoggedIn(): boolean {
  return !!localStorage.getItem('profile');
}

export default function ProfilePage() {
  const params = useParams();
  const personId = params?.personId as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'info' | 'error' } | null>(null);

  // Editable fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editDod, setEditDod] = useState('');
  const [editMotherId, setEditMotherId] = useState<number | null>(null);
  const [editFatherId, setEditFatherId] = useState<number | null>(null);
  const [editMotherRelation, setEditMotherRelation] = useState('BIOLOGICAL_MOTHER');
  const [editFatherRelation, setEditFatherRelation] = useState('BIOLOGICAL_FATHER');
  const [profileFile, setProfileFile] = useState<File | undefined>(undefined);
  const [bannerFile, setBannerFile] = useState<File | undefined>(undefined);
  const [obituaries, setObituaries] = useState<{ id: number; title: string; fileUrl: string; fileType: string }[]>([]);

  const loadProfile = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await apiFetch<Profile>(`/api/profile/${personId}`, { method: 'GET' });
      setProfile(p);
      const parts = (p.displayName || '').split(' ');
      setEditFirstName(parts[0] || '');
      setEditLastName(parts.slice(1).join(' ') || '');
      setEditDob(p.dateOfBirth || '');
      setEditDod(p.dateOfDeath || '');
      setEditMotherId(p.motherId ?? null);
      setEditFatherId(p.fatherId ?? null);
      const motherParent = p.parents?.find(r => r.personId === p.motherId);
      if (motherParent) setEditMotherRelation(motherParent.relation);
      else setEditMotherRelation('BIOLOGICAL_MOTHER');
      const fatherParent = p.parents?.find(r => r.personId === p.fatherId);
      if (fatherParent) setEditFatherRelation(fatherParent.relation);
      else setEditFatherRelation('BIOLOGICAL_FATHER');
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    setIsAdmin(getIsAdmin());
    setIsLoggedIn(getIsLoggedIn());
    loadProfile();
  }, [loadProfile]);

  // Fetch obituaries tagged to this person
  useEffect(() => {
    if (!personId) return;
    apiFetch<{ id: number; title: string; fileUrl: string; fileType: string }[]>(
      `/api/obituaries?personId=${personId}`,
      { method: 'GET' }
    )
      .then(setObituaries)
      .catch(() => setObituaries([]));
  }, [personId]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Upload images first if admin selected files
      let profilePictureUrl: string | undefined;
      let bannerImageUrl: string | undefined;
      if (isAdmin && profileFile) {
        const res = await uploadAnonymous('PROFILE', profileFile);
        profilePictureUrl = res.cdnUrl;
      }
      if (isAdmin && bannerFile) {
        const res = await uploadAnonymous('BANNER', bannerFile);
        bannerImageUrl = res.cdnUrl;
      }

      const body: any = {
        firstName: editFirstName || undefined,
        lastName: editLastName || undefined,
        dateOfBirth: editDob || undefined,
        dateOfDeath: editDod || undefined,
        motherId: editMotherId,
        fatherId: editFatherId,
        motherRelation: editMotherId ? editMotherRelation : undefined,
        fatherRelation: editFatherId ? editFatherRelation : undefined,
        ...(profilePictureUrl && { profilePictureUrl }),
        ...(bannerImageUrl && { bannerImageUrl }),
      };

      if (isAdmin) {
        await apiFetch(`/api/people/${profile.personId}`, { method: 'PUT', body });
        setSnack({ msg: 'Saved successfully.', severity: 'success' });
      } else {
        await apiFetch(`/api/people/${profile.personId}/change-requests`, { method: 'POST', body });
        setSnack({ msg: 'Changes submitted for admin review.', severity: 'info' });
      }
      setEditing(false);
      setProfileFile(undefined);
      setBannerFile(undefined);
      await loadProfile();
    } catch (err: any) {
      setSnack({ msg: err?.message || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPerson = async (firstName: string, lastName: string, dob?: string, dod?: string): Promise<number> => {
    const res = await apiFetch<{ personId: number }>('/api/people', {
      method: 'POST',
      body: { firstName, lastName, dateOfBirth: dob, dateOfDeath: dod },
    });
    return res.personId;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: 'var(--color-primary-500)' }} />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 6 }}>
        <Alert severity="error">{error || 'Profile not found'}</Alert>
      </Box>
    );
  }

  const p = profile;
  const isPeopleOnly = !p.hasAccount;
  const canEdit = isLoggedIn;

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Banner + avatar hero */}
      <Box className="card" sx={{ overflow: 'hidden', mb: 3, position: 'relative' }}>
        <Box
          sx={{
            height: { xs: 140, sm: 200 },
            background: p.bannerImageUrl
              ? `url(${p.bannerImageUrl}) center/cover no-repeat`
              : 'linear-gradient(135deg, #0d47a1 0%, #1976d2 50%, #42a5f5 100%)',
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: -6 }}>
          <Avatar
            src={p.profilePictureUrl || undefined}
            sx={{
              width: 96,
              height: 96,
              border: '4px solid white',
              boxShadow: 'var(--shadow-lg)',
              bgcolor: 'var(--color-primary-200)',
              fontSize: '2rem',
              fontWeight: 700,
            }}
          >
            {p.displayName?.charAt(0)?.toUpperCase()}
          </Avatar>
        </Box>

        <Box sx={{ px: 3, pb: 3, pt: 1.5, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
            {p.displayName}
            {(p.deceased || p.dateOfDeath) && (
              <Typography component="span" sx={{ ml: 1, fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                ✝
              </Typography>
            )}
          </Typography>
          {p.username && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.25 }}>
              @{p.username}
            </Typography>
          )}
          {p.dateOfBirth && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
              Born: {p.dateOfBirth}
            </Typography>
          )}
          {p.dateOfDeath && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.25 }}>
              Died: {p.dateOfDeath}
            </Typography>
          )}
          {p.location && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              {p.location}
            </Typography>
          )}
          {p.bio && (
            <Typography sx={{ mt: 2, color: 'var(--text-secondary)', maxWidth: 500, mx: 'auto', lineHeight: 1.6 }}>
              {p.bio}
            </Typography>
          )}

          {/* Obituary links for deceased profiles */}
          {obituaries.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 2, gap: 1 }}>
              {obituaries.map(ob => (
                <Chip
                  key={ob.id}
                  icon={<ArticleIcon />}
                  label={ob.title}
                  component="a"
                  href={ob.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  size="small"
                  sx={{
                    bgcolor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-700)',
                    fontWeight: 500,
                    '& .MuiChip-icon': { color: 'var(--color-primary-500)' },
                  }}
                />
              ))}
            </Stack>
          )}

          {isPeopleOnly && (
            <Chip
              label="No account"
              size="small"
              sx={{ mt: 1.5, bgcolor: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}
            />
          )}

          {/* Admin: Mark / unmark deceased */}
          {isAdmin && (
            <Box sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  const newValue = !(p.deceased || p.dateOfDeath);
                  try {
                    await apiFetch(`/api/people/${p.personId}/deceased`, {
                      method: 'PUT',
                      body: { deceased: newValue },
                    });
                    setSnack({ msg: newValue ? 'Marked as deceased' : 'Marked as living', severity: 'success' });
                    await loadProfile();
                  } catch {
                    setSnack({ msg: 'Failed to update', severity: 'error' });
                  }
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  borderColor: (p.deceased || p.dateOfDeath) ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                  color: (p.deceased || p.dateOfDeath) ? 'var(--color-primary-600)' : 'var(--text-secondary)',
                }}
              >
                {(p.deceased || p.dateOfDeath) ? 'Unmark Deceased' : 'Mark as Deceased ✝'}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Edit Button — visible for logged-in users on people-only profiles */}
      {isPeopleOnly && canEdit && !editing && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditing(true)}
            sx={{
              borderColor: 'var(--color-primary-500)',
              color: 'var(--color-primary-700)',
              '&:hover': { bgcolor: 'var(--color-primary-50)' },
            }}
          >
            Edit
          </Button>
        </Box>
      )}

      {/* Inline edit form — revealed only when "Edit" is clicked */}
      {isPeopleOnly && editing && (
        <Box className="card" sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {isAdmin ? 'Edit Person' : 'Propose Changes'}
            </Typography>
            <Button
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => setEditing(false)}
              sx={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </Button>
          </Stack>
          {!isAdmin && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Your edits will be submitted for admin review.
            </Alert>
          )}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="First Name *"
                value={editFirstName}
                onChange={e => setEditFirstName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Last Name"
                value={editLastName}
                onChange={e => setEditLastName(e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Date of Birth"
                value={editDob}
                onChange={e => setEditDob(e.target.value)}
                placeholder="YYYY-MM-DD"
                fullWidth
              />
              <TextField
                label="Date of Death"
                value={editDod}
                onChange={e => setEditDod(e.target.value)}
                placeholder="YYYY-MM-DD"
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <PersonAutocomplete
                  label="Mother"
                  value={editMotherId}
                  onChange={setEditMotherId}
                  onAddPerson={handleAddPerson}
                />
              </Box>
              {editMotherId && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Relation</InputLabel>
                  <Select value={editMotherRelation} label="Relation" onChange={e => setEditMotherRelation(e.target.value)}>
                    <MenuItem value="BIOLOGICAL_MOTHER">Biological Mother</MenuItem>
                    <MenuItem value="ADOPTIVE_MOTHER">Adoptive Mother</MenuItem>
                    <MenuItem value="STEP_MOTHER">Step Mother</MenuItem>
                    <MenuItem value="FOSTER_MOTHER">Foster Mother</MenuItem>
                    <MenuItem value="GUARDIAN">Guardian</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <PersonAutocomplete
                  label="Father"
                  value={editFatherId}
                  onChange={setEditFatherId}
                  onAddPerson={handleAddPerson}
                />
              </Box>
              {editFatherId && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Relation</InputLabel>
                  <Select value={editFatherRelation} label="Relation" onChange={e => setEditFatherRelation(e.target.value)}>
                    <MenuItem value="BIOLOGICAL_FATHER">Biological Father</MenuItem>
                    <MenuItem value="ADOPTIVE_FATHER">Adoptive Father</MenuItem>
                    <MenuItem value="STEP_FATHER">Step Father</MenuItem>
                    <MenuItem value="FOSTER_FATHER">Foster Father</MenuItem>
                    <MenuItem value="GUARDIAN">Guardian</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
            {/* Profile picture & banner uploads — admin only */}
            {isAdmin && (
              <>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PhotoCameraIcon fontSize="small" /> Profile Picture
                  </Typography>
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setProfileFile(f);
                  }} />
                  {profileFile && (
                    <Typography variant="caption" sx={{ color: 'var(--color-primary-600)', mt: 0.5, display: 'block' }}>
                      Selected: {profileFile.name}
                    </Typography>
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ImageIcon fontSize="small" /> Banner Image
                  </Typography>
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setBannerFile(f);
                  }} />
                  {bannerFile && (
                    <Typography variant="caption" sx={{ color: 'var(--color-primary-600)', mt: 0.5, display: 'block' }}>
                      Selected: {bannerFile.name}
                    </Typography>
                  )}
                </Box>
              </>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || !editFirstName.trim()}
                sx={{
                  bgcolor: 'var(--color-primary-600)',
                  '&:hover': { bgcolor: 'var(--color-primary-700)' },
                }}
              >
                {saving ? 'Saving…' : isAdmin ? 'Save' : 'Submit for Review'}
              </Button>
            </Box>
          </Stack>
        </Box>
      )}

      {/* Parents */}
      <Box className="card" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Parents</Typography>
        {p.parents?.length ? (
          <Stack spacing={1}>
            {p.parents.map(pr => (
              <Stack key={pr.personId} direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={pr.displayName}
                  component="a"
                  href={`/profile/${pr.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  ({pr.relation.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            No parents listed.
          </Typography>
        )}
      </Box>

      {/* Spouses / Partners */}
      {(p.spouses?.length ?? 0) > 0 && (
        <Box className="card" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Spouses / Partners</Typography>
          <Stack spacing={1}>
            {p.spouses.map(sp => (
              <Stack key={sp.personId} direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={sp.displayName}
                  component="a"
                  href={`/profile/${sp.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  ({sp.relation.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Siblings */}
      {(p.siblings?.length ?? 0) > 0 && (
        <Box className="card" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Siblings</Typography>
          <Stack spacing={1}>
            {p.siblings.map(s => (
              <Stack key={s.personId} direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={s.displayName}
                  component="a"
                  href={`/profile/${s.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      {/* Children */}
      <Box className="card" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Children</Typography>
        {p.children?.length ? (
          <Stack spacing={1}>
            {p.children.map(ch => (
              <Stack key={ch.personId} direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={ch.displayName}
                  component="a"
                  href={`/profile/${ch.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
            No children listed.
          </Typography>
        )}
      </Box>

      {/* Children editor */}
      {isLoggedIn && <ChildrenEditor personId={Number(personId)} hasAccount={profile?.hasAccount} />}

      {/* Snackbar feedback */}
      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
