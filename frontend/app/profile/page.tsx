'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { apiFetch, uploadForUser } from '../lib/api';
import { useAuth } from '../lib/useAuth';
import PersonAutocomplete from '../components/PersonAutocomplete';
import CdnAvatar from '../components/CdnAvatar';
import Image from '../components/CdnImage';
import TaggedMediaGrid from '../components/TaggedMediaGrid';

type Rel = { id: number; displayName: string; profilePictureUrl?: string | null };
type PersonRelDto = { personId: number; displayName: string; relation: string };
type FullProfile = {
  personId: number;
  displayName: string;
  parents: PersonRelDto[];
  children: PersonRelDto[];
  siblings: PersonRelDto[];
  spouses: PersonRelDto[];
  motherId?: number | null;
  fatherId?: number | null;
};
type ProfileDto = {
  id: number;
  personId?: number | null;
  username: string;
  email: string;
  userRole?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePictureUrl?: string | null;
  bannerImageUrl?: string | null;
  mother?: Rel | null;
  father?: Rel | null;
  children?: Rel[] | null;
};

type MyPendingChange = { field: string; newValue: string; label: string | null };
type MyPendingPerson = { requestId: number; firstName: string; lastName: string; dateOfBirth?: string };
type MyPendingChangesResponse = { profileChanges: MyPendingChange[]; pendingPeople: MyPendingPerson[] };

export default function MeProfilePage() {
  const [me, setMe] = useState<ProfileDto | null>(null);
  const { isAdmin: serverIsAdmin } = useAuth();
  const [msg, setMsg] = useState<{ type: 'success'|'error'|'info'; text: string }|null>(null);
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Editable fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [, setDisplayName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editPrefix, setEditPrefix] = useState('');
  const [editSuffix, setEditSuffix] = useState('');

  const [motherId, setMotherId] = useState<number | ''>('');
  const [fatherId, setFatherId] = useState<number | ''>('');
  const [motherRelation, setMotherRelation] = useState('BIOLOGICAL_MOTHER');
  const [fatherRelation, setFatherRelation] = useState('BIOLOGICAL_FATHER');

  // pending state for ui
  const [pendingChanges, setPendingChanges] = useState<MyPendingChange[]>([]);
  const [pendingPeople, setPendingPeople] = useState<MyPendingPerson[]>([]);

  // local image files
  const [bannerFile, setBannerFile] = useState<File | undefined>(undefined);
  const [profileFile, setProfileFile] = useState<File | undefined>(undefined);

  // Children editing — multiple slots with + button
  type ChildSlot = { key: string; personId: number | null; relation: string };
  const [childSlots, setChildSlots] = useState<ChildSlot[]>([]);

  // Sibling editing slots
  type SiblingSlot = { key: string; personId: number | null; relation: string };
  const [siblingSlots, setSiblingSlots] = useState<SiblingSlot[]>([]);

  // Spouse editing slots
  type SpouseSlot = { key: string; personId: number | null; relation: string };
  const [spouseSlots, setSpouseSlots] = useState<SpouseSlot[]>([]);

  // Full profile data (parents, children, siblings, spouses) from /api/profile/{personId}
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('profile');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ProfileDto;
        setMe(parsed);
        setUsername(parsed.username);
        setEmail(parsed.email);
        setDisplayName(parsed.displayName);
        // Use individual name fields from backend if available; fall back to displayName (stripping year range)
        if (parsed.firstName || parsed.lastName) {
          setEditFirstName(parsed.firstName || '');
          setEditLastName(parsed.lastName || '');
        } else {
          const cleaned = (parsed.displayName || '').replace(/\s*\(.*\)\s*$/, '');
          const nameParts = cleaned.split(' ');
          setEditFirstName(nameParts[0] || '');
          setEditLastName(nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
        }
        setMotherId(parsed.mother?.id ?? '');
        setFatherId(parsed.father?.id ?? '');
        // Initialize relation from parents if available
        // (will be overridden by fullProfile fetch below)
      } catch {}
    }

    // Fetch user's own pending changes
    apiFetch<MyPendingChangesResponse>('/api/profile-change-requests/mine')
      .then((resp) => {
        setPendingChanges(resp.profileChanges ?? []);
        setPendingPeople(resp.pendingPeople ?? []);
      })
      .catch(() => {});
  }, []);

  // Fetch full profile data (family relationships) from the profile API
  useEffect(() => {
    if (!me?.personId) return;
    apiFetch<FullProfile>(`/api/profile/${me.personId}`, { method: 'GET' })
      .then((fp) => {
        setFullProfile(fp);
        // Set mother/father IDs from full profile if not already set
        if (fp.motherId && !motherId) setMotherId(fp.motherId);
        if (fp.fatherId && !fatherId) setFatherId(fp.fatherId);
        // Initialize parent relations from full profile
        const motherParent = fp.parents?.find(p => p.personId === fp.motherId);
        if (motherParent?.relation) setMotherRelation(motherParent.relation);
        const fatherParent = fp.parents?.find(p => p.personId === fp.fatherId);
        if (fatherParent?.relation) setFatherRelation(fatherParent.relation);
      })
      .catch(() => {});
  }, [me?.personId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive pending labels for specific fields
  const pendingMotherLabel = pendingChanges.find((c) => c.field === 'mother_id')?.label;
  const pendingFatherLabel = pendingChanges.find((c) => c.field === 'father_id')?.label;
  const pendingChildren = pendingChanges.filter((c) => c.field === 'add_child');

  async function logout() {
    try {
      setLoggingOut(true);
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      localStorage.removeItem('profile');
      window.dispatchEvent(new Event('profile-updated'));
      window.location.href = '/login';
    }
  }

  function startEdit() {
    setMsg(null);
    setEditing(true);
  }
  function cancelEdit() {
    setBannerFile(undefined);
    setProfileFile(undefined);
    setEditing(false);
  }

  async function handleAddPerson(firstName: string, lastName: string, dob?: string, dod?: string): Promise<number | null> {
    if (serverIsAdmin) {
      // Admin: create person directly
      const res = await apiFetch<{ personId: number }>('/api/people', {
        method: 'POST',
        body: { firstName, lastName, dateOfBirth: dob, dateOfDeath: dod },
      });
      return res.personId;
    } else {
      // Non-admin: submit person creation for approval
      await apiFetch('/api/people/requests', {
        method: 'POST',
        body: { action: 'ADD', firstName, lastName, dateOfBirth: dob || undefined },
      });
      setMsg({ type: 'info', text: 'New person submitted for admin approval. Once approved, search for them to set the relationship.' });
      return null;
    }
  }

  async function saveEdit() {
    if (!me) return;
    setMsg(null);
    try {
      let newMe: ProfileDto = { ...me };

      // (1) Upload images if present
      if (bannerFile) {
        const res = await uploadForUser(me.id, 'BANNER', bannerFile);
        newMe.bannerImageUrl = res.cdnUrl;
      }
      if (profileFile) {
        const res = await uploadForUser(me.id, 'PROFILE', profileFile);
        newMe.profilePictureUrl = res.cdnUrl;
      }

      // (2) Persist direct fields via /api/users/me (DON'T send mother/father here)
      const origFirst = (me as ProfileDto).firstName || me.displayName?.replace(/\s*\(.*\)\s*$/, '').split(' ')[0] || '';
      const origLast = (me as ProfileDto).lastName || me.displayName?.replace(/\s*\(.*\)\s*$/, '').split(' ').slice(1).join(' ') || '';
      const nameChanged = editFirstName !== origFirst || editLastName !== origLast;
      if (username !== me.username || email !== me.email || nameChanged) {
        const updated = await apiFetch<ProfileDto>('/api/users/me', {
          method: 'PUT',
          body: {
            username,
            email,
            firstName: editFirstName,
            lastName: editLastName,
            middleName: editMiddleName || undefined,
            prefix: editPrefix || undefined,
            suffix: editSuffix || undefined,
          },
        });
        newMe = updated;
      }

      // (3) Submit approval-needed changes
      const changePayload: Array<{ field: string; newValue: string }> = [];
      if (motherId !== (me.mother?.id ?? '')) changePayload.push({ field: 'mother_id', newValue: motherId ? `${motherId}:${motherRelation}` : '' });
      if (fatherId !== (me.father?.id ?? '')) changePayload.push({ field: 'father_id', newValue: fatherId ? `${fatherId}:${fatherRelation}` : '' });

      // Children — each slot with a selected person becomes an add_child request
      for (const slot of childSlots) {
        if (slot.personId) {
          changePayload.push({ field: 'add_child', newValue: `${slot.personId}:${slot.relation}` });
        }
      }

      // Siblings — each slot becomes an add_sibling request
      for (const slot of siblingSlots) {
        if (slot.personId) {
          changePayload.push({ field: 'add_sibling', newValue: `${slot.personId}:${slot.relation}` });
        }
      }

      // Spouses — each slot becomes an add_spouse request
      for (const slot of spouseSlots) {
        if (slot.personId) {
          changePayload.push({ field: 'add_spouse', newValue: `${slot.personId}:${slot.relation}` });
        }
      }

      if (changePayload.length) {
        await apiFetch('/api/profile-change-requests', { method: 'POST', body: { changes: changePayload } });
        setChildSlots([]);
        setSiblingSlots([]);
        setSpouseSlots([]);
        // Refresh pending changes from server
        try {
          const resp = await apiFetch<MyPendingChangesResponse>('/api/profile-change-requests/mine');
          setPendingChanges(resp.profileChanges ?? []);
          setPendingPeople(resp.pendingPeople ?? []);
        } catch {}
        setMsg({ type: 'info', text: 'Submitted profile changes for admin approval.' });
      } else {
        setMsg({ type: 'success', text: 'Profile updated.' });
      }

      localStorage.setItem('profile', JSON.stringify(newMe));
      window.dispatchEvent(new Event('profile-updated'));
      setMe(newMe);
      setEditing(false);
      setBannerFile(undefined);
      setProfileFile(undefined);
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to update profile' });
    }
  }

  async function resetPassword() {
    if (!me?.email) return setMsg({ type: 'error', text: 'No email on file for password reset.' });
    try {
      await apiFetch('/api/auth/request-password-reset', { method: 'POST', body: { email: me.email } });
      setMsg({ type: 'info', text: 'Password reset link sent if the email exists.' });
    } catch (e: unknown) {
      setMsg({ type: 'error', text: (e as Error)?.message || 'Failed to send reset email' });
    }
  }

  if (!me) return (
    <Box sx={{ p: 6, textAlign: 'center' }}>
      <Typography sx={{ color: 'var(--text-secondary)' }}>Loading…</Typography>
    </Box>
  );

  const motherName = fullProfile?.parents?.find(p => p.relation === 'BIOLOGICAL_MOTHER')?.displayName
    || me?.mother?.displayName || null;
  const fatherName = fullProfile?.parents?.find(p => p.relation === 'BIOLOGICAL_FATHER')?.displayName
    || me?.father?.displayName || null;
  const familyParents = fullProfile?.parents ?? [];
  const familyChildren = fullProfile?.children ?? me?.children?.map(c => ({ personId: c.id, displayName: c.displayName, relation: 'CHILD' })) ?? [];
  const familySiblings = fullProfile?.siblings ?? [];
  const familySpouses = fullProfile?.spouses ?? [];

  const hasFamily = familyParents.length > 0 || familyChildren.length > 0
    || familySiblings.length > 0 || familySpouses.length > 0
    || !!pendingMotherLabel || !!pendingFatherLabel || pendingChildren.length > 0 || pendingPeople.length > 0;

  /** Format relation enum like BIOLOGICAL_FATHER → "Biological Father" */
  const formatRelation = (rel: string) =>
    rel.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Banner + avatar hero section */}
      <Box className="card" sx={{ overflow: 'hidden', mb: 3, position: 'relative' }}>
        {/* Banner image */}
        {me.bannerImageUrl ? (
          <Box sx={{ position: 'relative', height: { xs: 140, sm: 200 } }}>
            <Image
              src={me.bannerImageUrl}
              alt="Profile banner"
              fill
              style={{ objectFit: 'cover' }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              height: { xs: 140, sm: 200 },
              background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 50%, #42a5f5 100%)',
            }}
          />
        )}

        {/* Avatar overlapping banner */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: -6 }}>
          <CdnAvatar
            src={me.profilePictureUrl || undefined}
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
            {me.displayName?.charAt(0)?.toUpperCase()}
          </CdnAvatar>
        </Box>

        {/* Profile info */}
        <Box sx={{ px: 3, pb: 3, pt: 1.5, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
            {me.displayName}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.25 }}>
            @{me.username} &middot; {me.email}
          </Typography>
          {me.userRole && (
            <Chip
              label={me.userRole.replace('ROLE_', '')}
              size="small"
              sx={{
                mt: 1,
                bgcolor: serverIsAdmin ? 'var(--color-accent-400)' : 'var(--color-primary-50)',
                color: serverIsAdmin ? 'var(--color-gray-900)' : 'var(--color-primary-700)',
                fontWeight: 600,
                fontSize: '0.72rem',
              }}
            />
          )}
          {me.bio && (
            <Typography sx={{ mt: 2, color: 'var(--text-secondary)', maxWidth: 500, mx: 'auto', lineHeight: 1.6 }}>
              {me.bio}
            </Typography>
          )}

          {/* Family chips */}
          {!editing && hasFamily && (
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 2, gap: 1 }}>
              {familyParents.map(pr => !pendingMotherLabel || pr.relation !== 'BIOLOGICAL_MOTHER' ? (
                !pendingFatherLabel || pr.relation !== 'BIOLOGICAL_FATHER' ? (
                  <Chip
                    key={`parent-${pr.personId}`}
                    label={`${pr.relation.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}: ${pr.displayName}`}
                    component="a"
                    href={`/profile/${pr.personId}`}
                    clickable
                    variant="outlined"
                    size="small"
                  />
                ) : null
              ) : null)}
              {pendingMotherLabel && (
                <Chip
                  label={`Mother: ${pendingMotherLabel} (pending)`}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                />
              )}
              {pendingFatherLabel && (
                <Chip
                  label={`Father: ${pendingFatherLabel} (pending)`}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                />
              )}
              {familySiblings.map(s => (
                <Chip
                  key={`sibling-${s.personId}`}
                  label={`Sibling: ${s.displayName}`}
                  component="a"
                  href={`/profile/${s.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
              ))}
              {familySpouses.map(sp => (
                <Chip
                  key={`spouse-${sp.personId}`}
                  label={`${sp.relation.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}: ${sp.displayName}`}
                  component="a"
                  href={`/profile/${sp.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
              ))}
              {familyChildren.map(c => (
                <Chip
                  key={`child-${c.personId}`}
                  label={`${c.relation && c.relation !== 'CHILD' ? formatRelation(c.relation) : 'Child'}: ${c.displayName}`}
                  component="a"
                  href={`/profile/${c.personId}`}
                  clickable
                  variant="outlined"
                  size="small"
                />
              ))}
              {pendingChildren.map((pc, i) => (
                <Chip
                  key={`pending-child-${i}`}
                  label={`Child: ${pc.label} (pending)`}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                />
              ))}
              {pendingPeople.map((pp) => (
                <Chip
                  key={`pending-person-${pp.requestId}`}
                  label={`New person: ${pp.firstName} ${pp.lastName} (pending creation)`}
                  variant="outlined"
                  size="small"
                  sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                />
              ))}
            </Stack>
          )}

          {/* Action buttons */}
          <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
            {!editing ? (
              <>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={startEdit}
                  sx={{
                    bgcolor: 'var(--color-primary-500)',
                    '&:hover': { bgcolor: 'var(--color-primary-600)' },
                  }}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LogoutIcon />}
                  onClick={logout}
                  disabled={loggingOut}
                  sx={{
                    borderColor: 'var(--color-gray-300)',
                    color: 'var(--color-gray-600)',
                    '&:hover': { borderColor: 'var(--color-gray-400)', bgcolor: 'var(--color-gray-50)' },
                  }}
                >
                  {loggingOut ? 'Logging out…' : 'Log Out'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  size="small"
                  onClick={saveEdit}
                  sx={{
                    bgcolor: 'var(--color-primary-500)',
                    '&:hover': { bgcolor: 'var(--color-primary-600)' },
                  }}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={cancelEdit}
                  sx={{
                    borderColor: 'var(--color-gray-300)',
                    color: 'var(--color-gray-600)',
                    '&:hover': { borderColor: 'var(--color-gray-400)' },
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Alert messages */}
      {msg && <Alert severity={msg.type === 'info' ? 'info' : msg.type} sx={{ mb: 3 }}>{msg.text}</Alert>}

      {/* Tagged Media */}
      {me.personId && <TaggedMediaGrid personId={me.personId} />}

      {/* Edit form when editing */}
      {editing && (
        <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--color-primary-700)', mb: 2.5 }}>
            Edit Profile
          </Typography>
          <Stack spacing={2.5}>
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />

            <Divider><Chip label="Name" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Prefix" select value={editPrefix}
                onChange={(e) => setEditPrefix(e.target.value)}
                sx={{ minWidth: 90 }} size="small"
              >
                {['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.'].map(p => <MenuItem key={p} value={p}>{p || '—'}</MenuItem>)}
              </TextField>
              <TextField label="First Name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} fullWidth required />
            </Stack>
            <Stack direction="row" spacing={1.5}>
              <TextField label="Middle Name" value={editMiddleName} onChange={(e) => setEditMiddleName(e.target.value)} fullWidth />
              <TextField label="Last Name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} fullWidth required />
              <TextField
                label="Suffix" select value={editSuffix}
                onChange={(e) => setEditSuffix(e.target.value)}
                sx={{ minWidth: 90 }} size="small"
              >
                {['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'Esq.'].map(s => <MenuItem key={s} value={s}>{s || '—'}</MenuItem>)}
              </TextField>
            </Stack>

            <Divider />

            <PersonAutocomplete
              label={`Mother${pendingMotherLabel ? ` — ${pendingMotherLabel} (pending)` : ''}`}
              value={typeof motherId === 'number' ? motherId : null}
              onChange={(pid) => setMotherId(pid ?? '')}
              onAddPerson={handleAddPerson}
              placeholder={pendingMotherLabel ? `${pendingMotherLabel} (pending)` : motherName ? motherName : 'Search or add…'}
              excludePersonIds={me?.personId ? [me.personId] : undefined}
            />
            {typeof motherId === 'number' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Mother Relation</InputLabel>
                <Select
                  value={motherRelation}
                  label="Mother Relation"
                  onChange={(e) => setMotherRelation(e.target.value)}
                >
                  <MenuItem value="BIOLOGICAL_MOTHER">Biological Mother</MenuItem>
                  <MenuItem value="ADOPTIVE_MOTHER">Adoptive Mother</MenuItem>
                  <MenuItem value="STEP_MOTHER">Step Mother</MenuItem>
                  <MenuItem value="FOSTER_MOTHER">Foster Mother</MenuItem>
                  <MenuItem value="GUARDIAN">Guardian</MenuItem>
                </Select>
              </FormControl>
            )}
            <PersonAutocomplete
              label={`Father${pendingFatherLabel ? ` — ${pendingFatherLabel} (pending)` : ''}`}
              value={typeof fatherId === 'number' ? fatherId : null}
              onChange={(pid) => setFatherId(pid ?? '')}
              onAddPerson={handleAddPerson}
              placeholder={pendingFatherLabel ? `${pendingFatherLabel} (pending)` : fatherName ? fatherName : 'Search or add…'}
              excludePersonIds={me?.personId ? [me.personId] : undefined}
            />
            {typeof fatherId === 'number' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Father Relation</InputLabel>
                <Select
                  value={fatherRelation}
                  label="Father Relation"
                  onChange={(e) => setFatherRelation(e.target.value)}
                >
                  <MenuItem value="BIOLOGICAL_FATHER">Biological Father</MenuItem>
                  <MenuItem value="ADOPTIVE_FATHER">Adoptive Father</MenuItem>
                  <MenuItem value="STEP_FATHER">Step Father</MenuItem>
                  <MenuItem value="FOSTER_FATHER">Foster Father</MenuItem>
                  <MenuItem value="GUARDIAN">Guardian</MenuItem>
                </Select>
              </FormControl>
            )}

            <Divider />

            {/* ── Children Section ── */}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Children
            </Typography>

            {familyChildren.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {familyChildren.map((c) => (
                  <Chip
                    key={c.personId}
                    label={`${c.relation && c.relation !== 'CHILD' ? formatRelation(c.relation) : 'Child'}: ${c.displayName}`}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            )}

            {/* Pending children (awaiting approval) */}
            {pendingChildren.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {pendingChildren.map((pc, i) => (
                  <Chip
                    key={`pending-child-edit-${i}`}
                    label={`${pc.label} (pending)`}
                    variant="outlined"
                    size="small"
                    sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                  />
                ))}
              </Stack>
            )}

            {/* Pending person creations */}
            {pendingPeople.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {pendingPeople.map((pp) => (
                  <Chip
                    key={`pending-person-edit-${pp.requestId}`}
                    label={`${pp.firstName} ${pp.lastName} (pending creation)`}
                    variant="outlined"
                    size="small"
                    sx={{ borderColor: 'var(--color-accent-400)', color: 'var(--color-accent-600)', fontStyle: 'italic' }}
                  />
                ))}
              </Stack>
            )}

            {me.personId && serverIsAdmin ? (
              <>

                {childSlots.map((slot, idx) => (
                  <Stack key={slot.key} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <PersonAutocomplete
                        label={`Child ${idx + 1}`}
                        value={slot.personId}
                        onChange={(pid) =>
                          setChildSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, personId: pid } : s)),
                          )
                        }
                        onAddPerson={handleAddPerson}
                        placeholder="Search or add…"
                      />
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Relation</InputLabel>
                      <Select
                        value={slot.relation}
                        label="Relation"
                        onChange={(e) =>
                          setChildSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, relation: e.target.value } : s)),
                          )
                        }
                      >
                        <MenuItem value="BIOLOGICAL_MOTHER">Biological Mother</MenuItem>
                        <MenuItem value="BIOLOGICAL_FATHER">Biological Father</MenuItem>
                        <MenuItem value="STEP_MOTHER">Step Mother</MenuItem>
                        <MenuItem value="STEP_FATHER">Step Father</MenuItem>
                        <MenuItem value="ADOPTIVE_MOTHER">Adoptive Mother</MenuItem>
                        <MenuItem value="ADOPTIVE_FATHER">Adoptive Father</MenuItem>
                        <MenuItem value="FOSTER_MOTHER">Foster Mother</MenuItem>
                        <MenuItem value="FOSTER_FATHER">Foster Father</MenuItem>
                        <MenuItem value="GUARDIAN">Guardian</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      size="small"
                      onClick={() => setChildSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                      sx={{ mt: { xs: 0, sm: 0.5 }, color: 'var(--color-gray-500)' }}
                      title="Remove"
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() =>
                    setChildSlots((prev) => [
                      ...prev,
                      { key: `child-${Date.now()}`, personId: null, relation: 'BIOLOGICAL_FATHER' },
                    ])
                  }
                  sx={{
                    alignSelf: 'flex-start',
                    borderColor: 'var(--color-primary-300)',
                    color: 'var(--color-primary-600)',
                    '&:hover': { borderColor: 'var(--color-primary-400)', bgcolor: 'var(--color-primary-50)' },
                  }}
                >
                  + Add Child
                </Button>
              </>
            ) : null}

            <Divider />

            {/* ── Siblings Section ── */}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Siblings
            </Typography>

            {familySiblings.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {familySiblings.map((s) => (
                  <Chip
                    key={`sibling-edit-${s.personId}`}
                    label={s.displayName}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            )}

            {me.personId ? (
              <>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  Add siblings below, then click &ldquo;Save Changes&rdquo; to submit for approval.
                </Typography>

                {siblingSlots.map((slot, idx) => (
                  <Stack key={slot.key} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <PersonAutocomplete
                        label={`Sibling ${idx + 1}`}
                        value={slot.personId}
                        onChange={(pid) =>
                          setSiblingSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, personId: pid } : s)),
                          )
                        }
                        onAddPerson={handleAddPerson}
                        placeholder="Search or add…"
                      />
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Relation</InputLabel>
                      <Select
                        value={slot.relation}
                        label="Relation"
                        onChange={(e) =>
                          setSiblingSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, relation: e.target.value } : s)),
                          )
                        }
                      >
                        <MenuItem value="SIBLING">Full Sibling</MenuItem>
                        <MenuItem value="HALF_SIBLING">Half Sibling</MenuItem>
                        <MenuItem value="STEP_SIBLING">Step Sibling</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      size="small"
                      onClick={() => setSiblingSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                      sx={{ mt: { xs: 0, sm: 0.5 }, color: 'var(--color-gray-500)' }}
                      title="Remove"
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() =>
                    setSiblingSlots((prev) => [
                      ...prev,
                      { key: `sibling-${Date.now()}`, personId: null, relation: 'SIBLING' },
                    ])
                  }
                  sx={{
                    alignSelf: 'flex-start',
                    borderColor: 'var(--color-primary-300)',
                    color: 'var(--color-primary-600)',
                    '&:hover': { borderColor: 'var(--color-primary-400)', bgcolor: 'var(--color-primary-50)' },
                  }}
                >
                  + Add Sibling
                </Button>
              </>
            ) : null}

            <Divider />

            {/* ── Spouses Section ── */}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              Spouses / Partners
            </Typography>

            {familySpouses.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {familySpouses.map((sp) => (
                  <Chip
                    key={`spouse-edit-${sp.personId}`}
                    label={`${sp.displayName} (${sp.relation.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')})`}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Stack>
            )}

            {me.personId ? (
              <>
                <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                  Add spouses/partners below, then click &ldquo;Save Changes&rdquo; to submit for approval.
                </Typography>

                {spouseSlots.map((slot, idx) => (
                  <Stack key={slot.key} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                    <Box sx={{ flex: 1 }}>
                      <PersonAutocomplete
                        label={`Spouse ${idx + 1}`}
                        value={slot.personId}
                        onChange={(pid) =>
                          setSpouseSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, personId: pid } : s)),
                          )
                        }
                        onAddPerson={handleAddPerson}
                        placeholder="Search or add…"
                      />
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Relation</InputLabel>
                      <Select
                        value={slot.relation}
                        label="Relation"
                        onChange={(e) =>
                          setSpouseSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, relation: e.target.value } : s)),
                          )
                        }
                      >
                        <MenuItem value="SPOUSE">Spouse</MenuItem>
                        <MenuItem value="EX_SPOUSE">Ex-Spouse</MenuItem>
                        <MenuItem value="PARTNER">Partner</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      size="small"
                      onClick={() => setSpouseSlots((prev) => prev.filter((s) => s.key !== slot.key))}
                      sx={{ mt: { xs: 0, sm: 0.5 }, color: 'var(--color-gray-500)' }}
                      title="Remove"
                    >
                      <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() =>
                    setSpouseSlots((prev) => [
                      ...prev,
                      { key: `spouse-${Date.now()}`, personId: null, relation: 'SPOUSE' },
                    ])
                  }
                  sx={{
                    alignSelf: 'flex-start',
                    borderColor: 'var(--color-primary-300)',
                    color: 'var(--color-primary-600)',
                    '&:hover': { borderColor: 'var(--color-primary-400)', bgcolor: 'var(--color-primary-50)' },
                  }}
                >
                  + Add Spouse / Partner
                </Button>
              </>
            ) : null}

            <Divider />

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Profile picture
              </Typography>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setProfileFile(f);
              }} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Banner image
              </Typography>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setBannerFile(f);
              }} />
            </Box>

            <Button
              variant="outlined"
              startIcon={<LockResetIcon />}
              onClick={resetPassword}
              sx={{
                borderColor: 'var(--color-gray-300)',
                color: 'var(--color-gray-600)',
                '&:hover': { borderColor: 'var(--color-gray-400)' },
                alignSelf: 'flex-start',
              }}
            >
              Send Password Reset Email
            </Button>
          </Stack>
        </Box>
      )}

    </Box>
  );
}
