'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Box, Button } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockRendererList from '../components/BlockRenderer';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { ContentBlock } from '../lib/pageContentTypes';
import type { ProfileDto } from '../lib/types';

const BlockEditor = dynamic(() => import('../components/BlockEditor'), { ssr: false });

interface Props {
  pageKey: string;
  initialBlocks: ContentBlock[];
}

/**
 * Client component that handles admin inline editing of page content.
 * The initial blocks are server-fetched and passed as props.
 */
export default function EditablePageContent({ pageKey, initialBlocks }: Props) {
  const { full } = useFamilyName();

  // ── Auth state ──
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Content state ──
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);

  // ── Edit mode state ──
  const [editing, setEditing] = useState(false);
  const [editBlocks, setEditBlocks] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load admin status ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p: ProfileDto = JSON.parse(raw);
        const role = p.userRole;
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Enter edit mode ──
  const startEditing = () => {
    setEditBlocks(JSON.parse(JSON.stringify(blocks))); // deep clone
    setSaveError(null);
    setEditing(true);
  };

  // ── Save ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/page-content/${pageKey}`, {
        method: 'PUT',
        body: { blocks: JSON.stringify(editBlocks) },
      });
      setBlocks(editBlocks);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [editBlocks, pageKey]);

  // ── Cancel edit ──
  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  // ── Resolve {family} placeholders ──
  const resolved: ContentBlock[] = JSON.parse(
    JSON.stringify(blocks).replaceAll('{family}', full),
  );

  return (
    <>
      {/* Admin edit button */}
      {isAdmin && !editing && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={startEditing}
            sx={{ textTransform: 'none' }}
          >
            Edit Page
          </Button>
        </Box>
      )}

      {/* Edit mode */}
      {editing ? (
        <BlockEditor
          blocks={editBlocks}
          onChange={setEditBlocks}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          error={saveError}
        />
      ) : (
        /* View mode */
        <>
          {resolved.length > 0 && resolved[0].type === 'hero' && (
            <BlockRendererList blocks={[resolved[0]]} />
          )}

          <Box className="card" sx={{ p: { xs: 3, sm: 5 }, overflow: 'hidden' }}>
            <BlockRendererList
              blocks={resolved[0]?.type === 'hero' ? resolved.slice(1) : resolved}
            />
            <Box sx={{ clear: 'both' }} />
          </Box>
        </>
      )}
    </>
  );
}
