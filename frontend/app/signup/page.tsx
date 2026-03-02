'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  TextField,
  Alert,
  Stack,
  Typography,
  MenuItem,
  FormControl,
  IconButton,
  InputLabel,
  Select,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { apiFetch, uploadAnonymous } from '../lib/api';
import PersonAutocomplete from '../components/PersonAutocomplete';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { ProfileDto, PersonSummaryDto } from '../lib/types';

const PREFIX_OPTIONS = ['', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Rev.'];
const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'Esq.'];

type PersonHit = { personId: number; displayName: string; dateOfBirth?: string | null; dateOfDeath?: string | null; deceased?: boolean; archived?: boolean };

function useDebounced<T>(val: T, ms = 300) {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return v;
}

export default function SignupPage() {
  const { full } = useFamilyName();
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
    phoneNumber: '',
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
  const [isArchivedClaim, setIsArchivedClaim] = useState(false);

  // Name search autocomplete state
  const [nameSearchInput, setNameSearchInput] = useState('');
  const [nameSearchResults, setNameSearchResults] = useState<PersonHit[]>([]);
  const [archivedSearchResults, setArchivedSearchResults] = useState<PersonHit[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const debouncedNameSearch = useDebounced(nameSearchInput, 350);
  const debouncedDob = useDebounced(form.dateOfBirth, 350);
  const mounted = useRef(true);

  // Per-result family info expand state
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(null);
  const [familyCache, setFamilyCache] = useState<Record<number, ProfileDto | null>>({});
  const [familyLoading, setFamilyLoading] = useState<number | null>(null);

  async function toggleFamilyInfo(personId: number) {
    if (expandedPersonId === personId) { setExpandedPersonId(null); return; }
    setExpandedPersonId(personId);
    if (familyCache[personId] !== undefined) return; // already loaded
    try {
      setFamilyLoading(personId);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const res = await fetch(`${apiBase}/api/profile/${personId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const profile: ProfileDto = await res.json();
      setFamilyCache(prev => ({ ...prev, [personId]: profile }));
    } catch {
      setFamilyCache(prev => ({ ...prev, [personId]: null }));
    } finally {
      setFamilyLoading(null);
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Search for claimable (living, unclaimed) profiles as user types names
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const first = form.firstName.trim();
      if (!first || first.length < 2) { setNameSearchResults([]); setArchivedSearchResults([]); return; }
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

  // Search for archived but living profiles when name + DOB are both provided
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const first = form.firstName.trim();
      const dob = form.dateOfBirth;
      if (!first || first.length < 2 || !dob) { setArchivedSearchResults([]); return; }
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
        const params = new URLSearchParams({ firstName: first, dateOfBirth: dob });
        if (form.lastName.trim()) params.set('lastName', form.lastName.trim());
        const res = await fetch(`${apiBase}/api/people/unclaimed-archived?${params}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Search failed');
        const data: PersonHit[] = await res.json();
        if (!cancelled && mounted.current) setArchivedSearchResults(data || []);
      } catch {
        if (!cancelled && mounted.current) setArchivedSearchResults([]);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedNameSearch, debouncedDob]);  // eslint-disable-line react-hooks/exhaustive-deps

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
      setIsArchivedClaim(person.archived === true);
      setForm((prev) => ({
        ...prev,
        firstName: profile.firstName || prev.firstName,
        lastName: profile.lastName || prev.lastName,
        middleName: profile.middleName || prev.middleName,
        prefix: profile.prefix || prev.prefix,
        suffix: profile.suffix || prev.suffix,
        dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
        bio: profile.bio || prev.bio,
      }));

      // Auto-populate mother/father and their relations from the claimed profile
      setMotherId(profile.motherId ?? null);
      setFatherId(profile.fatherId ?? null);

      // Derive relation types from parents array
      const motherParent = profile.parents?.find(p => p.relation && p.relation.includes('MOTHER'));
      const fatherParent = profile.parents?.find(p => p.relation && p.relation.includes('FATHER'));
      if (motherParent?.relation) setMotherRelation(motherParent.relation);
      if (fatherParent?.relation) setFatherRelation(fatherParent.relation);

      // Clear search results
      setNameSearchResults([]);
    } catch (err) {
      console.error('Failed to claim person:', err);
    }
  }

  function unclaim() {
    setClaimPersonId(null);
    setClaimedProfile(null);
    setIsArchivedClaim(false);
    setMotherId(null);
    setFatherId(null);
    setArchivedSearchResults([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    // Validate phone number format if provided (must be E.164 after stripping formatting)
    if (form.phoneNumber) {
      const normalized = form.phoneNumber.replace(/[\s\-().]/g, '');
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
        setMsg({ type: 'error', text: 'Phone number must be in international format, e.g. +15551234567' });
        return;
      }
    }

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
        phoneNumber: form.phoneNumber || undefined,
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

      const result = await apiFetch<{ approved: boolean; message: string }>('/api/auth/signup', {
        method: 'POST',
        body: payload,
      });

      // Redirect to login with the appropriate message
      // Do NOT save profile to localStorage — no session exists yet
      window.location.href = result.approved
        ? '/login?reason=signup-approved'
        : '/login?reason=signup-pending';
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
                <Stack spacing={0}>
                  {nameSearchResults.map(p => {
                    const profile = familyCache[p.personId];
                    const hasFamily = profile && (
                      (profile.parents?.length ?? 0) > 0 ||
                      (profile.siblings?.length ?? 0) > 0 ||
                      (profile.spouses?.length ?? 0) > 0 ||
                      (profile.children?.length ?? 0) > 0
                    );
                    return (
                      <Box key={p.personId}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            px: 1.5, py: 0.75,
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(var(--color-primary-rgb, 59,130,246), 0.08)' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{p.displayName}</Typography>
                            {p.dateOfBirth && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                b. {p.dateOfBirth}
                              </Typography>
                            )}
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); toggleFamilyInfo(p.personId); }}
                              sx={{ ml: 0.5, p: 0.25 }}
                            >
                              {familyLoading === p.personId ? (
                                <CircularProgress size={14} />
                              ) : expandedPersonId === p.personId ? (
                                <ExpandLessIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                              )}
                            </IconButton>
                          </Box>
                          <Typography
                            variant="caption"
                            color="primary"
                            sx={{ fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', ml: 1 }}
                            onClick={() => claimPerson(p)}
                          >
                            This is me
                          </Typography>
                        </Box>
                        <Collapse in={expandedPersonId === p.personId && profile !== undefined}>
                          {profile && hasFamily && (
                            <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
                              <Stack spacing={0.25}>
                                {(profile.parents?.length ?? 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    <strong>Parents:</strong> {profile.parents!.map(r => r.displayName).join(', ')}
                                  </Typography>
                                )}
                                {(profile.siblings?.length ?? 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    <strong>Siblings:</strong> {profile.siblings!.map(r => r.displayName).join(', ')}
                                  </Typography>
                                )}
                                {(profile.spouses?.length ?? 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    <strong>Spouse(s):</strong> {profile.spouses!.map(r => r.displayName).join(', ')}
                                  </Typography>
                                )}
                                {(profile.children?.length ?? 0) > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    <strong>Children:</strong> {profile.children!.map(r => r.displayName).join(', ')}
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          )}
                          {profile && !hasFamily && (
                            <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                No family connections on file
                              </Typography>
                            </Box>
                          )}
                          {profile === null && (
                            <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
                              <Typography variant="caption" color="error">Failed to load family info</Typography>
                            </Box>
                          )}
                        </Collapse>
                      </Box>
                    );
                  })}
                </Stack>
              </Alert>
            )}

            {nameSearchLoading && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={16} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Searching...</Typography>
              </Stack>
            )}

            {/* Archived profile matches — requires name + DOB match */}
            {archivedSearchResults.length > 0 && !claimPersonId && (
              <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  We found archived records matching your name and date of birth.
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  If one of these is you, request to claim it. An admin will review and approve your request.
                </Typography>
                <Stack spacing={0.5}>
                  {archivedSearchResults.map(p => (
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
                        '&:hover': { bgcolor: 'rgba(255, 152, 0, 0.08)' },
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.displayName}</Typography>
                        {p.dateOfBirth && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Born: {p.dateOfBirth}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.main' }}>
                        Request to claim
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Alert>
            )}

            {/* Claimed profile confirmation */}
            {claimPersonId && claimedProfile && (
              <Alert severity={isArchivedClaim ? 'warning' : 'success'} variant="outlined">
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">
                      {isArchivedClaim ? 'Requesting to claim archived profile: ' : 'Claiming profile: '}
                      <strong>{claimedProfile.displayName}</strong>
                    </Typography>
                    <Button size="small" onClick={unclaim}>
                      Cancel
                    </Button>
                  </Stack>

                  {isArchivedClaim && (
                    <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 500 }}>
                      This is an archived record. Your signup will require admin approval to verify your identity.
                    </Typography>
                  )}

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
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={onChange}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />

            <Divider><Chip label="Account" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            <TextField name="username" label="Username" required value={form.username} onChange={onChange} fullWidth />
            <TextField name="email" label="Email" type="email" required value={form.email} onChange={onChange} fullWidth />
            <TextField name="password" label="Password" type="password" required value={form.password} onChange={onChange} fullWidth />
            <TextField name="phoneNumber" label="Phone number (optional)" type="tel" value={form.phoneNumber} onChange={onChange} fullWidth
              placeholder="+1 (555) 123-4567"
              helperText="For SMS notifications — you can add or change this later"
            />
            <TextField name="bio" label="Bio (optional)" multiline minRows={3} value={form.bio} onChange={onChange} fullWidth />

            <Divider><Chip label="Family Links" size="small" sx={{ fontSize: '0.75rem' }} /></Divider>

            {claimPersonId ? (
              // When claiming a profile, show parents as read-only to prevent genealogy corruption.
              // Users can request corrections after signup through the profile change request flow.
              <>
                {(motherId != null || fatherId != null) ? (
                  <Alert severity="info" variant="outlined" sx={{ py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Family connections from claimed profile</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                      These are locked to the claimed profile. If incorrect, you may be claiming the wrong person.
                      You can request corrections after your account is approved.
                    </Typography>
                    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                      {motherId != null && (
                        <Typography variant="body2">
                          <strong>Mother:</strong> {claimedProfile?.parents?.find((p: PersonSummaryDto) => p.relation?.includes('MOTHER'))?.displayName ?? `Person #${motherId}`}
                          {motherRelation && (
                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                              ({motherRelation.replace(/_/g, ' ').toLowerCase()})
                            </Typography>
                          )}
                        </Typography>
                      )}
                      {fatherId != null && (
                        <Typography variant="body2">
                          <strong>Father:</strong> {claimedProfile?.parents?.find((p: PersonSummaryDto) => p.relation?.includes('FATHER'))?.displayName ?? `Person #${fatherId}`}
                          {fatherRelation && (
                            <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                              ({fatherRelation.replace(/_/g, ' ').toLowerCase()})
                            </Typography>
                          )}
                        </Typography>
                      )}
                    </Stack>
                  </Alert>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                    No parent connections on this profile. You can add them after your account is approved.
                  </Typography>
                )}
              </>
            ) : (
              // Normal signup (no claim) — editable parent fields
              <>
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
                  placeholder="Start typing a name…"
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
              </>
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

            <Typography variant="body2" sx={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              Want to support the reunion?{' '}
              <a href="/donate" style={{ color: 'var(--color-primary-500)', fontWeight: 600 }}>Make a donation</a>
              {' '}&mdash; no account needed
            </Typography>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}
