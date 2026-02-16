'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CdnAvatar from './CdnAvatar';
import AddIcon from '@mui/icons-material/PersonAddAlt';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

type PersonHit = {
  personId: number;
  displayName: string;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  deceased?: boolean;
  profilePictureUrl?: string | null;
  username?: string | null;
};

export interface PersonAutocompleteProps {
  label: string;
  value?: number | null;
  onChange: (personId: number | null) => void;
  /** Optional richer callback that also provides the display name. */
  onChangeFull?: (person: { personId: number; displayName: string } | null) => void;
  /** Creates or requests a person. Return personId for immediate use, or null if submitted for approval. */
  onAddPerson?: (firstName: string, lastName: string, dob?: string, dod?: string) => Promise<number | null>;
  disabled?: boolean;
  placeholder?: string;
  /** Person IDs to exclude from autocomplete results. */
  excludePersonIds?: number[];
}

function useDebounced<T>(val: T, ms = 250) {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return v;
}

export default function PersonAutocomplete({
  label,
  value,
  onChange,
  onChangeFull,
  onAddPerson,
  disabled,
  placeholder,
  excludePersonIds,
}: PersonAutocompleteProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PersonHit[]>([]);
  const [adderOpen, setAdderOpen] = useState(false);
  const [adderFirst, setAdderFirst] = useState('');
  const [adderLast, setAdderLast] = useState('');
  const [adderDob, setAdderDob] = useState('');
  const [adderDod, setAdderDod] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  const debounced = useDebounced(input, 250);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debounced?.trim()) { setOptions([]); return; }
      try {
        setLoading(true);
        const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
        const res = await fetch(`${apiBase}/api/people/search?q=${encodeURIComponent(debounced)}&limit=10`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Search failed');
        let data: PersonHit[] = await res.json();
        if (excludePersonIds?.length) {
          data = data.filter(p => !excludePersonIds.includes(p.personId));
        }
        if (!cancelled && mounted.current) setOptions(data || []);
      } catch {
        if (!cancelled && mounted.current) setOptions([]);
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const selectedOption = useMemo(() => {
    if (value == null) return null;
    return options.find(o => o.personId === value) ?? null;
  }, [value, options]);

  async function confirmAdd() {
    if (!onAddPerson) return;
    const first = adderFirst.trim();
    const last = adderLast.trim();
    if (!first) return;
    setSaving(true);
    setPendingMsg(null);
    try {
      const id = await onAddPerson(first, last, adderDob || undefined, adderDod || undefined);
      if (id != null) {
        onChange(id);
      } else {
        setPendingMsg('Person creation submitted for admin approval.');
      }
      resetAdder();
    } catch {
      // error visible in network
    } finally {
      setSaving(false);
    }
  }

  function resetAdder() {
    setAdderOpen(false);
    setAdderFirst('');
    setAdderLast('');
    setAdderDob('');
    setAdderDod('');
  }

  return (
    <Box>
      <Autocomplete<PersonHit, false, false, false>
        disabled={disabled || adderOpen}
        open={adderOpen ? false : undefined}
        value={selectedOption}
        options={options}
        loading={loading}
        getOptionLabel={(o) => o?.displayName ?? ''}
        onChange={(_, opt) => {
          onChange(opt ? opt.personId : null);
          onChangeFull?.(opt ? { personId: opt.personId, displayName: opt.displayName } : null);
          setPendingMsg(null);
          resetAdder();
        }}
        onInputChange={(_, v) => setInput(v)}
        isOptionEqualToValue={(a, b) => a.personId === b.personId}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => {
          // Build date range string: "1945–2020", "b. 1990", etc.
          let dateInfo = '';
          const birthYear = option.dateOfBirth?.slice(0, 4);
          const deathYear = option.dateOfDeath?.slice(0, 4);
          if (birthYear && deathYear) dateInfo = `${birthYear}–${deathYear}`;
          else if (birthYear) dateInfo = `b. ${birthYear}`;
          else if (deathYear) dateInfo = `d. ${deathYear}`;

          return (
            <li {...props} key={option.personId}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 0.5 }}>
                <CdnAvatar
                  src={option.profilePictureUrl ?? undefined}
                  alt={option.displayName}
                  sx={{ width: 36, height: 36, fontSize: 14 }}
                >
                  {option.displayName?.charAt(0) ?? '?'}
                </CdnAvatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                    {option.displayName}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {dateInfo && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {dateInfo}
                      </Typography>
                    )}
                    {option.username && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        @{option.username}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </li>
          );
        }}
        noOptionsText={
          onAddPerson ? (
            <Box
              sx={{ px: 1.5, py: 1, cursor: 'pointer' }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAdderOpen(true);
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography>No matches.</Typography>
                <AddIcon fontSize="small" color="primary" />
                <Typography variant="body2" color="primary">Add person</Typography>
              </Stack>
            </Box>
          ) : (
            'No options'
          )
        }
        clearOnBlur={false}
        freeSolo={false}
        selectOnFocus
        handleHomeEndKeys
      />

      {/* ── Add person form — renders OUTSIDE the dropdown ── */}
      <Collapse in={adderOpen}>
        <Box
          sx={{
            mt: 1, p: 2,
            border: '1px solid var(--color-primary-200)',
            borderRadius: 2,
            bgcolor: 'var(--color-primary-50, #f0f7ff)',
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>
                Add new person
              </Typography>
              <IconButton size="small" onClick={resetAdder}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small" label="First name" value={adderFirst}
                onChange={(e) => setAdderFirst(e.target.value)}
                autoFocus fullWidth
              />
              <TextField
                size="small" label="Last name" value={adderLast}
                onChange={(e) => setAdderLast(e.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small" label="Date of Birth" type="date"
                value={adderDob} onChange={(e) => setAdderDob(e.target.value)}
                InputLabelProps={{ shrink: true }} fullWidth
              />
              <TextField
                size="small" label="Date of Death" type="date"
                value={adderDod} onChange={(e) => setAdderDod(e.target.value)}
                InputLabelProps={{ shrink: true }} fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 0.5 }}>
              <Button size="small" onClick={resetAdder} sx={{ color: 'var(--color-gray-600)' }}>
                Cancel
              </Button>
              <Button
                size="small" variant="contained" onClick={confirmAdd}
                disabled={!adderFirst.trim() || saving}
                startIcon={saving ? <CircularProgress size={14} /> : <CheckIcon />}
                sx={{ bgcolor: 'var(--color-primary-500)', '&:hover': { bgcolor: 'var(--color-primary-600)' } }}
              >
                {saving ? 'Creating…' : 'Create Person'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Collapse>

      {pendingMsg && (
        <Typography variant="caption" sx={{ color: 'var(--color-primary-600)', mt: 0.5, display: 'block' }}>
          {pendingMsg}
        </Typography>
      )}
    </Box>
  );
}
