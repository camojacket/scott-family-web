'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Select,
  MenuItem,
  Tooltip,
  Stack,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import type { ContentBlock, ImageBlock, ImageRowBlock } from '../lib/pageContentTypes';
import { apiFetch } from '../lib/api';

const TiptapEditor = dynamic(() => import('../blog/TiptapEditor'), { ssr: false });

// ─── Add Block Dialog ───────────────────────────────────────

const BLOCK_TYPES = [
  { type: 'text', label: 'Text Block', icon: <TextFieldsIcon /> },
  { type: 'image', label: 'Image', icon: <ImageIcon /> },
  { type: 'image-row', label: 'Images Side by Side', icon: <ViewColumnIcon /> },
  { type: 'hero', label: 'Hero Banner', icon: <ViewHeadlineIcon /> },
  { type: 'divider', label: 'Divider', icon: <HorizontalRuleIcon /> },
  { type: 'list', label: 'List', icon: <FormatListBulletedIcon /> },
] as const;

function createDefaultBlock(type: string): ContentBlock {
  switch (type) {
    case 'text':
      return { type: 'text', html: '<p>Enter text here...</p>' };
    case 'image':
      return { type: 'image', src: '', alt: '', caption: '', alignment: 'center', height: 300 };
    case 'image-row':
      return {
        type: 'image-row',
        images: [
          { type: 'image', src: '', alt: '', caption: '', alignment: 'center', height: 300 },
          { type: 'image', src: '', alt: '', caption: '', alignment: 'center', height: 300 },
        ],
        gap: 16,
      };
    case 'hero':
      return { type: 'hero', src: '', alt: '', title: 'Hero Title' };
    case 'divider':
      return { type: 'divider' };
    case 'list':
      return { type: 'list', style: 'bullet', items: ['Item 1'] };
    default:
      return { type: 'text', html: '' };
  }
}

// ─── Image Upload helper ────────────────────────────────────

function ImageUploadButton({
  onUploaded,
  label,
}: {
  onUploaded: (cdnUrl: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await apiFetch<{ cdnUrl: string; key: string }>(
          '/api/page-content/upload-image',
          { method: 'POST', body: fd }
        );
        onUploaded(res.cdnUrl);
      } catch (err) {
        alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onUploaded]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />
      <Button
        size="small"
        variant="outlined"
        startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {label || 'Upload Image'}
      </Button>
    </>
  );
}

// ─── Individual block editors ───────────────────────────────

function HeroBlockEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'hero' }>;
  onChange: (b: Extract<ContentBlock, { type: 'hero' }>) => void;
}) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Title"
        fullWidth
        size="small"
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
      />
      <TextField
        label="Image URL"
        fullWidth
        size="small"
        value={block.src}
        onChange={(e) => onChange({ ...block, src: e.target.value })}
      />
      <ImageUploadButton
        label="Upload Hero Image"
        onUploaded={(url) => onChange({ ...block, src: url })}
      />
      <TextField
        label="Alt Text"
        fullWidth
        size="small"
        value={block.alt}
        onChange={(e) => onChange({ ...block, alt: e.target.value })}
      />
    </Stack>
  );
}

function TextBlockEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'text' }>;
  onChange: (b: Extract<ContentBlock, { type: 'text' }>) => void;
}) {
  return (
    <Box>
      <TiptapEditor
        value={block.html}
        onChange={(html) => onChange({ ...block, html })}
      />
    </Box>
  );
}

function ImageBlockEditor({
  block,
  onChange,
}: {
  block: ImageBlock;
  onChange: (b: ImageBlock) => void;
}) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Image URL"
        fullWidth
        size="small"
        value={block.src}
        onChange={(e) => onChange({ ...block, src: e.target.value })}
      />
      <ImageUploadButton
        label="Upload Image"
        onUploaded={(url) => onChange({ ...block, src: url })}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label="Alt Text"
          size="small"
          value={block.alt}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Caption"
          size="small"
          value={block.caption || ''}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
          sx={{ flex: 1 }}
        />
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ minWidth: 140 }}>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'var(--text-secondary)' }}>
            Alignment
          </Typography>
          <Select
            size="small"
            fullWidth
            value={block.alignment}
            onChange={(e) =>
              onChange({ ...block, alignment: e.target.value as ImageBlock['alignment'] })
            }
          >
            <MenuItem value="left">Left (text wraps)</MenuItem>
            <MenuItem value="center">Center</MenuItem>
            <MenuItem value="right">Right (text wraps)</MenuItem>
            <MenuItem value="full">Full Width</MenuItem>
          </Select>
        </Box>
        <TextField
          label="Height (px)"
          type="number"
          size="small"
          value={block.height || 300}
          onChange={(e) => onChange({ ...block, height: parseInt(e.target.value) || 300 })}
          sx={{ width: 120 }}
        />
      </Stack>
      {block.src && (
        <Box
          sx={{
            mt: 1,
            height: 120,
            borderRadius: 1,
            overflow: 'hidden',
            position: 'relative',
            bgcolor: 'rgba(0,0,0,0.05)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Box>
      )}
    </Stack>
  );
}

function ListBlockEditor({
  block,
  onChange,
}: {
  block: Extract<ContentBlock, { type: 'list' }>;
  onChange: (b: Extract<ContentBlock, { type: 'list' }>) => void;
}) {
  const updateItem = (idx: number, value: string) => {
    const items = [...block.items];
    items[idx] = value;
    onChange({ ...block, items });
  };
  const addItem = () => onChange({ ...block, items: [...block.items, ''] });
  const removeItem = (idx: number) => {
    const items = block.items.filter((_, i) => i !== idx);
    onChange({ ...block, items: items.length ? items : [''] });
  };

  return (
    <Stack spacing={1.5}>
      <Select
        size="small"
        value={block.style}
        onChange={(e) => onChange({ ...block, style: e.target.value as 'bullet' | 'numbered' })}
        sx={{ width: 160 }}
      >
        <MenuItem value="bullet">Bullet List</MenuItem>
        <MenuItem value="numbered">Numbered List</MenuItem>
      </Select>
      {block.items.map((item, i) => (
        <Stack key={i} direction="row" spacing={1} alignItems="center">
          <Typography sx={{ color: 'var(--text-secondary)', minWidth: 20 }}>
            {block.style === 'numbered' ? `${i + 1}.` : '\u2022'}
          </Typography>
          <TextField
            size="small"
            fullWidth
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
          />
          <IconButton size="small" onClick={() => removeItem(i)} color="error">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
        Add Item
      </Button>
    </Stack>
  );
}

function ImageRowBlockEditor({
  block,
  onChange,
}: {
  block: ImageRowBlock;
  onChange: (b: ImageRowBlock) => void;
}) {
  const updateImage = (idx: number, updated: ImageBlock) => {
    const images = [...block.images];
    images[idx] = updated;
    onChange({ ...block, images });
  };

  const addImage = () => {
    onChange({
      ...block,
      images: [
        ...block.images,
        { type: 'image', src: '', alt: '', caption: '', alignment: 'center', height: 300 },
      ],
    });
  };

  const removeImage = (idx: number) => {
    if (block.images.length <= 2) return; // minimum 2 images
    onChange({ ...block, images: block.images.filter((_, i) => i !== idx) });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Gap (px)"
          type="number"
          size="small"
          value={block.gap ?? 16}
          onChange={(e) => onChange({ ...block, gap: parseInt(e.target.value) || 16 })}
          sx={{ width: 120 }}
        />
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
          {block.images.length} images side by side
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<AddIcon />} onClick={addImage}>
          Add Image
        </Button>
      </Stack>

      {block.images.map((img, i) => (
        <Paper
          key={i}
          variant="outlined"
          sx={{ p: 2, borderColor: 'var(--border-color)', position: 'relative' }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary-700)' }}>
              Image {i + 1}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={block.images.length <= 2 ? 'Minimum 2 images required' : 'Remove image'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => removeImage(i)}
                  color="error"
                  disabled={block.images.length <= 2}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Stack spacing={1.5}>
            <TextField
              label="Image URL"
              fullWidth
              size="small"
              value={img.src}
              onChange={(e) => updateImage(i, { ...img, src: e.target.value })}
            />
            <ImageUploadButton
              label="Upload Image"
              onUploaded={(url) => updateImage(i, { ...img, src: url })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Alt Text"
                size="small"
                value={img.alt}
                onChange={(e) => updateImage(i, { ...img, alt: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Caption"
                size="small"
                value={img.caption || ''}
                onChange={(e) => updateImage(i, { ...img, caption: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Height (px)"
              type="number"
              size="small"
              value={img.height || 300}
              onChange={(e) => updateImage(i, { ...img, height: parseInt(e.target.value) || 300 })}
              sx={{ width: 120 }}
            />
            {img.src && (
              <Box
                sx={{
                  height: 80,
                  borderRadius: 1,
                  overflow: 'hidden',
                  position: 'relative',
                  bgcolor: 'rgba(0,0,0,0.05)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

// ─── Single Block Editor Wrapper ────────────────────────────

function BlockEditorCard({
  block,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  onUpdate: (b: ContentBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const typeLabels: Record<string, string> = {
    hero: 'Hero Banner',
    text: 'Text Block',
    image: 'Image',
    'image-row': 'Images Side by Side',
    divider: 'Divider',
    list: 'List',
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        borderColor: 'var(--border-color)',
        '&:hover': { borderColor: 'var(--color-primary-300)' },
      }}
    >
      {/* Block header with controls */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            bgcolor: 'var(--color-primary-50)',
            color: 'var(--color-primary-700)',
            px: 1.5,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {typeLabels[block.type] || block.type}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
          #{index + 1}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Move Up">
          <span>
            <IconButton size="small" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move Down">
          <span>
            <IconButton size="small" onClick={onMoveDown} disabled={index === total - 1}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete Block">
          <IconButton size="small" onClick={onDelete} color="error">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Block-specific editor */}
      {block.type === 'hero' && (
        <HeroBlockEditor
          block={block}
          onChange={(b) => onUpdate(b)}
        />
      )}
      {block.type === 'text' && (
        <TextBlockEditor
          block={block}
          onChange={(b) => onUpdate(b)}
        />
      )}
      {block.type === 'image' && (
        <ImageBlockEditor
          block={block}
          onChange={(b) => onUpdate(b)}
        />
      )}
      {block.type === 'image-row' && (
        <ImageRowBlockEditor
          block={block}
          onChange={(b) => onUpdate(b)}
        />
      )}
      {block.type === 'divider' && (
        <Box sx={{ py: 1 }}>
          <Divider />
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Horizontal divider — no configuration needed.
          </Typography>
        </Box>
      )}
      {block.type === 'list' && (
        <ListBlockEditor
          block={block}
          onChange={(b) => onUpdate(b)}
        />
      )}
    </Paper>
  );
}

// ─── Main Block Editor Component ────────────────────────────

interface BlockEditorProps {
  /** Current blocks array */
  blocks: ContentBlock[];
  /** Called whenever blocks change */
  onChange: (blocks: ContentBlock[]) => void;
  /** Called when admin clicks Save */
  onSave: () => void;
  /** Called when admin clicks Cancel */
  onCancel: () => void;
  /** Whether a save operation is in progress */
  saving?: boolean;
  /** Error message to display */
  error?: string | null;
}

export default function BlockEditor({
  blocks,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: BlockEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  // ── Block operations ──

  const updateBlock = useCallback(
    (index: number, updated: ContentBlock) => {
      const next = [...blocks];
      next[index] = updated;
      onChange(next);
    },
    [blocks, onChange]
  );

  const deleteBlock = useCallback(
    (index: number) => {
      onChange(blocks.filter((_, i) => i !== index));
    },
    [blocks, onChange]
  );

  const moveBlock = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= blocks.length) return;
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  const insertBlock = useCallback(
    (type: string, atIndex: number) => {
      const newBlock = createDefaultBlock(type);
      const next = [...blocks];
      next.splice(atIndex, 0, newBlock);
      onChange(next);
    },
    [blocks, onChange]
  );

  const handleAddClick = (afterIndex?: number) => {
    setInsertIndex(afterIndex !== undefined ? afterIndex + 1 : blocks.length);
    setAddDialogOpen(true);
  };

  const handleAddConfirm = (type: string) => {
    insertBlock(type, insertIndex ?? blocks.length);
    setAddDialogOpen(false);
  };

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} alignItems="center">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
          onClick={onSave}
          disabled={saving}
          sx={{ textTransform: 'none' }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={onCancel}
          disabled={saving}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleAddClick()}
          sx={{ textTransform: 'none' }}
        >
          Add Block
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Block list */}
      {blocks.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            borderStyle: 'dashed',
            color: 'var(--text-secondary)',
          }}
        >
          <Typography>No content blocks yet. Click &quot;Add Block&quot; to get started.</Typography>
        </Paper>
      )}

      {blocks.map((block, i) => (
        <Box key={i}>
          <BlockEditorCard
            block={block}
            index={i}
            total={blocks.length}
            onUpdate={(b) => updateBlock(i, b)}
            onDelete={() => deleteBlock(i)}
            onMoveUp={() => moveBlock(i, i - 1)}
            onMoveDown={() => moveBlock(i, i + 1)}
          />
          {/* Insert-between button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 0.5 }}>
            <Tooltip title="Insert block here">
              <IconButton
                size="small"
                onClick={() => handleAddClick(i)}
                sx={{
                  opacity: 0.4,
                  '&:hover': { opacity: 1, color: 'var(--color-primary-600)' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ))}

      {/* Add block dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Content Block</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {BLOCK_TYPES.map(({ type, label, icon }) => (
              <Button
                key={type}
                variant="outlined"
                startIcon={icon}
                onClick={() => handleAddConfirm(type)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  py: 1.5,
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
