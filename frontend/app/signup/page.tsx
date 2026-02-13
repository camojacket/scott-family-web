'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  TextField,
  Alert,
  Stack,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { apiFetch, uploadAnonymous } from '../lib/api';
import PersonAutocomplete from '../components/PersonAutocomplete';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { ProfileDto, PersonSummaryDto } from '../lib/types';

const PREFIX_OPTIONS = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.'];
const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'Esq.'];

type PersonHit = { personId: number; displayName: string; dateOfBirth?: string | null; dateOfDeath?: string | null; deceased?: boolean };

function useDebounced<T>(val: T, ms = 300) {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return v;
}

export default function SignupPage() {
  const { family, full } = useFamilyName();
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    middleName: '',
    prefix: '',
    suffix: '',
    dateOfBirth: '',
    bio: '',
    profileFile: undefined as File | undefined,
    bannerFile: undefined as File | undefined,
  });
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [motherId, setMotherId] = useState<number | null>(null);
  const [fatherId, setFatherId] = useState<number | null>(null);
  const [motherRelation, setMotherRelation] = useState('BIOLOGICAL_MOTHER');
  const [fatherRelation, setFatherRelation] = useState('BIOLOGICAL_FATHER');

  // Profile claim state
  const [claimPersonId, setClaimPersonId] = useState<number | null>(null);
  const [claimedProfile, setClaimedProfile] = useState<ProfileDto | null>(null);

  // Name search autocomplete state
  const [nameSearchInput, setNameSearchInput] = useState('');
  const [nameSearchResults, setNameSearchResults] = useState<PersonHit[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const debouncedNameSearch = useDebounced(nameSearchInput, 350);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Search for claimable (living, unclaimed) profiles as user types names
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const first = form.firstName.trim();
      if (!first || first.length < 2) { setNameSearchResults([]); return; }
      try {
        setNameSearchLoading(true);
        const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
        const params = new URLSearchParams({ firstName: first });
        if (form.lastName.trim()) params.set('lastName', form.lastName.trim());
        const res = await fetch(`${apiBase}/api/people/unclaimed?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Search failed');
        const data: PersonHit[] = await res.json();
        if (!cancelled && mounted.current) setNameSearchResults(data || []);
      } catch {
        if (!cancelled && mounted.current) setNameSearchResults([]);
      } finally {
        if (!cancelled && mounted.current) setNameSearchLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedNameSearch]);  // eslint-disable-line react-hooks/exhaustive-deps

  // When user types first or last name, update the debounce trigger
  useEffect(() => {
    const parts = [form.firstName, form.lastName].filter(Boolean).join(' ').trim();
    setNameSearchInput(parts);
  }, [form.firstName, form.lastName]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // If user manually edits names, unclaim
    if (['firstName', 'lastName', 'middleName'].includes(e.target.name) && claimPersonId) {
      unclaim();
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>, field: 'profileFile' | 'bannerFile') => {
    const f = e.target.files?.[0];
    if (f) setForm((prev) => ({ ...prev, [field]: f }));
  };

  // Claim a person — fetch their full profile and auto-populate everything
  async function claimPerson(person: PersonHit) {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const res = await fetch(`${apiBase}/api/profile/${person.personId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const profile: ProfileDto = await res.json();

      setClaimPersonId(person.personId);
      setClaimedProfile(profile);
      setForm((prev) => ({
        ...prev,
        firstName: profile.firstName || prev.firstName,
        lastName: profile.lastName || prev.lastName,
        middleName: profile.middleName || prev.middleName,
        prefix: profile.prefix || prev.prefix,
        suffix: profile.suffix || prev.suffix,
        dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
      }));

      // Auto-populate mother/father
      setMotherId(profile.motherId ?? null);
      setFatherId(profile.fatherId ?? null);

      // Clear search results
      setNameSearchResults([]);
    } catch (err) {
      console.error('Failed to claim person:', err);
    }
  }

  function unclaim() {
    setClaimPersonId(null);
    setClaimedProfile(null);
    setMotherId(null);
    setFatherId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      let profilePictureUrl: string | undefined;
      let bannerImageUrl: string | undefined;

      if (form.profileFile) {
        const up = await uploadAnonymous('PROFILE', form.profileFile);
        profilePictureUrl = up.cdnUrl;
      }
      if (form.bannerFile) {
        const up = await uploadAnonymous('BANNER', form.bannerFile);
        bannerImageUrl = up.cdnUrl;
      }

      const payload: Record<string, unknown> = {
        username: form.username,
        password: form.password,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName || undefined,
        prefix: form.prefix || undefined,
        suffix: form.suffix || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        bio: form.bio,
        profilePictureUrl,
        bannerImageUrl,
      };

      if (claimPersonId != null) {
        payload.claimPersonId = claimPersonId;
      }

      if (motherId != null) {
        payload.motherId = motherId;
        payload.motherRelation = motherRelation;
      }

      if (fatherId != null) {
        payload.fatherId = fatherId;
        payload.fatherRelation = fatherRelation;
      }

      const profile = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: payload,
      });

      localStorage.setItem('profile', JSON.stringify(profile));
      setMsg({
        type: 'info',
        text: 'Signup received. An admin must approve your account. You will receive an email once approved.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setMsg({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }

  // Claimed person's related people for display
  const claimedChildren = claimedProfile?.children || [];
  const claimedSpouses = claimedProfile?.spouses || [];

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 4, sm: 6 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 800, color: 'var(--color-primary-700)', letterSpacing: '-0.02em', mb: 0.5 }}
        >
          Join the Family
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
          Create an account to connect with the {full} family
        </Typography>
      </Box>

      <Box className="card" sx={{ p: { xs: 3, sm: 4 } }}>
        {msg && <Alert severity={msg.type === 'info' ? 'info' : msg.type} sx={{ mb: 3 }}>{msg.text}</Alert>}
        <form onSubmit={onSubmit}>
          <Stack spacing={2.5}>

            <Divider><Chip label="Name" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: -1 }}>
              Start typing your name. If you already exist in our records, select yourself to link your account.
            </Typography>

            <Stack direction="row" spacing={1.5}>
              <TextField
                name="prefix" label="Prefix" select value={form.prefix}
                onChange={onChange} sx={{ minWidth: 90 }} size="small"
              >
                {PREFIX_OPTIONS.map(p => <MenuItem key={p} value={p}>{p || '—'}</MenuItem>)}
              </TextField>
              <TextField name="firstName" label="First Name" required value={form.firstName} onChange={onChange} fullWidth />
            </Stack>

            <Stack direction="row" spacing={1.5}>
              <TextField name="middleName" label="Middle Name" value={form.middleName} onChange={onChange} fullWidth />
              <TextField name="lastName" label="Last Name" required value={form.lastName} onChange={onChange} fullWidth />
              <TextField
                name="suffix" label="Suffix" select value={form.suffix}
                onChange={onChange} sx={{ minWidth: 90 }} size="small"
              >
                {SUFFIX_OPTIONS.map(s => <MenuItem key={s} value={s}>{s || '—'}</MenuItem>)}
              </TextField>
            </Stack>

            {/* Name search results — autocomplete suggestions */}
            {nameSearchResults.length > 0 && !claimPersonId && (
              <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  We found matching profiles. Is this you?
                </Typography>
                <Stack spacing={0.5}>
                  {nameSearchResults.map(p => (
                    <Box
                      key={p.personId}
                      onClick={() => claimPerson(p)}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        px: 1.5, py: 0.75,
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(var(--color-primary-rgb, 59,130,246), 0.08)' },
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.displayName}</Typography>
                      </Box>
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                        This is me
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Alert>
            )}

            {nameSearchLoading && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={16} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Searching...</Typography>
              </Stack>
            )}

            {/* Claimed profile confirmation */}
            {claimPersonId && claimedProfile && (
              <Alert severity="success" variant="outlined">
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      Claiming profile: <strong>{claimedProfile.displayName}</strong>
                    </Typography>
                    <Button size="small" onClick={unclaim}>
                      Cancel
                    </Button>
                  </Stack>

                  {/* Show auto-populated family info */}
                  {(claimedProfile.parents?.length ?? 0) > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Parents: {claimedProfile.parents?.map(p => p.displayName).join(', ')}
                    </Typography>
                  )}
                  {claimedChildren.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Children: {claimedChildren.map((c: PersonSummaryDto) => c.displayName).join(', ')}
                    </Typography>
                  )}
                  {claimedSpouses.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Spouse(s): {claimedSpouses.map((s: PersonSummaryDto) => s.displayName).join(', ')}
                    </Typography>
                  )}
                </Stack>
              </Alert>
            )}

            <TextField
              name="dateOfBirth"
              label="Date of Birth (optional)"
              type="date"
              value={form.dateOfBirth}
              onChange={onChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <Divider><Chip label="Account" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <TextField name="username" label="Username" required value={form.username} onChange={onChange} fullWidth />
            <TextField name="email" label="Email" type="email" required value={form.email} onChange={onChange} fullWidth />
            <TextField name="password" label="Password" type="password" required value={form.password} onChange={onChange} fullWidth />
            <TextField name="bio" label="Bio (optional)" multiline minRows={3} value={form.bio} onChange={onChange} fullWidth />

            <Divider><Chip label="Family Links" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <PersonAutocomplete
              label="Mother (optional)"
              value={motherId}
              onChange={(pid) => setMotherId(pid)}
              placeholder="Start typing a name…"
            />
            {motherId != null && (
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
              label="Father (optional)"
              value={fatherId}
              onChange={(pid) => setFatherId(pid)}
              placeholder="Start typing a name\u2026"
            />
            {fatherId != null && (
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

            <Divider><Chip label="Photos" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Profile Picture (optional)
              </Typography>
              <input type="file" accept="image/*" onChange={(e) => onFile(e, 'profileFile')} />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Banner Image (optional)
              </Typography>
              <input type="file" accept="image/*" onChange={(e) => onFile(e, 'bannerFile')} />
            </Box>

            <Alert severity="info" variant="outlined" sx={{ fontSize: '0.82rem' }}>
              Your signup is subject to admin approval. You&apos;ll receive an email once reviewed.
            </Alert>

            <Button
              variant="contained"
              type="submit"
              disabled={loading}
              fullWidth
              size="large"
              sx={{
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
                py: 1.25,
              }}
            >
              {loading ? 'Submitting…' : 'Create Account'}
            </Button>

            <Typography variant="body2" sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <a href="/login" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>Login</a>
            </Typography>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}
