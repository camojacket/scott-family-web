'use client';
import * as React from 'react';
import { Alert, Box, Button, MenuItem, Select, Stack, Typography } from '@mui/material';
import PersonAutocomplete from './PersonAutocomplete';

const RELS = [
  'BIOLOGICAL_MOTHER','BIOLOGICAL_FATHER','ADOPTIVE_PARENT','STEP_PARENT','GUARDIAN','OTHER'
] as const;

export default function ChildrenEditor({ personId, hasAccount, apiBase }: { personId: number; hasAccount?: boolean; apiBase?: string }) {
  const base = apiBase ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080';
  const [childId, setChildId] = React.useState<number | null>(null);
  const [relation, setRelation] = React.useState<typeof RELS[number]>('BIOLOGICAL_FATHER');
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setMsg(null);

    // If parent has a user account, go through the pending request flow
    if (hasAccount) {
      if (!childId) { setMsg({ type: 'error', text: 'Please select a child first.' }); return; }
      try {
        const r = await fetch(`${base}/api/people/requests`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'LINK_CHILD',
            targetPersonId: childId,
            parentPersonId: personId,
            relation,
          }),
        });
        if (r.status === 429) {
          setMsg({ type: 'error', text: 'Maximum pending requests reached. Wait for admin review.' });
          return;
        }
        if (!r.ok) { setMsg({ type: 'error', text: 'Could not submit link request.' }); return; }
        setMsg({ type: 'info', text: 'Link request submitted for admin approval.' });
        setChildId(null);
      } catch {
        setMsg({ type: 'error', text: 'Could not submit link request.' });
      }
      return;
    }

    // Otherwise, link directly (non-user-backed people)
    const body: Record<string, unknown> = { relation };
    if (childId) body.childId = childId;
    const r = await fetch(`${base}/api/people/${personId}/children`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    if (!r.ok) { setMsg({ type: 'error', text: 'Could not link child.' }); return; }
    window.location.reload();
  };

  return (
    <Box sx={{ p:2, border:'1px solid #eee', borderRadius:2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Add / Link Child</Typography>
      {hasAccount && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
          This person has an account — child linking requires admin approval.
        </Typography>
      )}
      {msg && <Alert severity={msg.type === 'info' ? 'info' : msg.type} sx={{ mb: 1 }}>{msg.text}</Alert>}
      <Stack direction={{ xs:'column', sm:'row' }} spacing={1.5} alignItems="center">
        <Box sx={{ flex:1 }}>
          <PersonAutocomplete label="Child"
                              value={childId}
                              onChange={(pid)=>setChildId(pid)} />
        </Box>
        <Select value={relation} onChange={(e)=>setRelation(e.target.value as typeof RELS[number])} sx={{ minWidth: 240 }}>
          {RELS.map(r => <MenuItem key={r} value={r}>{r.replaceAll('_',' ')}</MenuItem>)}
        </Select>
        <Button variant="contained" onClick={save} disabled={!relation}>Save</Button>
      </Stack>
    </Box>
  );
}
