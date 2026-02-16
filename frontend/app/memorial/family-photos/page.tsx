/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Autocomplete,
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Chip,
  Paper,
  Fade,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import RepeatIcon from '@mui/icons-material/Repeat';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SortIcon from '@mui/icons-material/Sort';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PersonIcon from '@mui/icons-material/Person';
import { apiFetch } from '../../lib/api';
import { BlockBlobClient } from '@azure/storage-blob';
import type {
  GalleryImage,
  GalleryUploadResponse,
  GalleryUpdateRequest,
  GallerySasRequest,
  GallerySasResponse,
  GalleryRegisterRequest,
  GalleryDeleteBatchRequest,
  ImageTag,
} from '../../lib/types';

interface PersonSearchResult {
  personId: number;
  displayName: string;
}

// ─── Types ──────────────────────────────────────────────────

type ViewMode = 'grid-sm' | 'grid-lg' | 'list';
type SortBy = 'date-desc' | 'date-asc' | 'uploaded-desc' | 'uploaded-asc' | 'name-asc';
type SlideshowMode = 'sequential' | 'shuffle';

function isVideoContent(contentType: string): boolean {
  return contentType.startsWith('video/');
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

interface PendingUpload {
  file: File;
  caption: string;
  imageDate: string;
  preview: string;
  progress: number;      // 0-100, tracks direct-to-Azure upload progress
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ─── Component ──────────────────────────────────────────────

export default function FamilyPhotosPage() {
  // Auth
  const [isAdmin, setIsAdmin] = useState(false);

  // Gallery data
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>('grid-sm');
  const [sortBy, setSortBy] = useState<SortBy>('date-desc');

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Slideshow
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowMode, setSlideshowMode] = useState<SlideshowMode>('sequential');
  const slideshowTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideshowSpeed = 4000; // ms

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit dialog
  const [editImage, setEditImage] = useState<GalleryImage | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Tag editing (inside edit dialog)
  const [editTags, setEditTags] = useState<ImageTag[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState<PersonSearchResult[]>([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Selection mode (admin bulk-delete)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Auth check ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p = JSON.parse(raw);
        const role = p?.userRole;
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load gallery ────────────────────────────────────────────

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<GalleryImage[]>('/api/gallery/images');
      setImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadImages(); }, [loadImages]);

  // ── Sorting ─────────────────────────────────────────────────

  const sortedImages = React.useMemo(() => {
    const sorted = [...images];
    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => {
          if (!a.imageDate && !b.imageDate) return 0;
          if (!a.imageDate) return 1;
          if (!b.imageDate) return -1;
          return b.imageDate.localeCompare(a.imageDate);
        });
        break;
      case 'date-asc':
        sorted.sort((a, b) => {
          if (!a.imageDate && !b.imageDate) return 0;
          if (!a.imageDate) return 1;
          if (!b.imageDate) return -1;
          return a.imageDate.localeCompare(b.imageDate);
        });
        break;
      case 'uploaded-desc':
        sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        break;
      case 'uploaded-asc':
        sorted.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.fileName.localeCompare(b.fileName));
        break;
    }
    return sorted;
  }, [images, sortBy]);

  // ── Lightbox navigation ─────────────────────────────────────

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  const lightboxPrev = () => {
    setLightboxIdx((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
  };

  const lightboxNext = useCallback(() => {
    setLightboxIdx((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));
  }, [sortedImages.length]);

  const closeLightbox = () => {
    setLightboxOpen(false);
    stopSlideshow();
  };

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ── Slideshow ───────────────────────────────────────────────

  const shuffleNext = useCallback(() => {
    if (sortedImages.length <= 1) return;
    let next: number;
    do {
      next = Math.floor(Math.random() * sortedImages.length);
    } while (next === lightboxIdx && sortedImages.length > 1);
    setLightboxIdx(next);
  }, [sortedImages.length, lightboxIdx]);

  const startSlideshow = () => {
    if (sortedImages.length === 0) return;
    if (!lightboxOpen) {
      setLightboxIdx(slideshowMode === 'shuffle' ? Math.floor(Math.random() * sortedImages.length) : 0);
      setLightboxOpen(true);
    }
    setSlideshowActive(true);
  };

  const stopSlideshow = () => {
    setSlideshowActive(false);
    if (slideshowTimer.current) {
      clearInterval(slideshowTimer.current);
      slideshowTimer.current = null;
    }
  };

  useEffect(() => {
    if (slideshowActive) {
      slideshowTimer.current = setInterval(() => {
        if (slideshowMode === 'shuffle') {
          shuffleNext();
        } else {
          lightboxNext();
        }
      }, slideshowSpeed);
    }
    return () => {
      if (slideshowTimer.current) {
        clearInterval(slideshowTimer.current);
        slideshowTimer.current = null;
      }
    };
  }, [slideshowActive, slideshowMode, slideshowSpeed, shuffleNext, lightboxNext]);

  // ── File selection helpers ──────────────────────────────────

  const addFilesToPending = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: PendingUpload[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      newFiles.push({
        file,
        caption: nameWithoutExt,
        imageDate: '',
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      });
    }
    setPendingUploads((prev) => [...prev, ...newFiles]);
  };

  const removePending = (idx: number) => {
    setPendingUploads((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updatePending = (idx: number, field: 'caption' | 'imageDate', value: string) => {
    setPendingUploads((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      pendingUploads.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload (direct-to-Azure via SAS tokens) ─────────────────

  const handleUpload = async () => {
    if (pendingUploads.length === 0) return;
    setUploading(true);

    // Mark all as uploading
    setPendingUploads((prev) =>
      prev.map((p) => ({ ...p, status: 'uploading' as const, progress: 0 }))
    );

    try {
      // Step 1: Request SAS URLs from backend
      const sasReq: GallerySasRequest = {
        files: pendingUploads.map((p) => ({
          fileName: p.file.name,
          contentType: p.file.type || 'application/octet-stream',
        })),
      };

      const sasRes = await apiFetch<GallerySasResponse>('/api/gallery/sas', {
        method: 'POST',
        body: sasReq,
      });

      // Step 2: Upload each file directly to Azure Blob Storage
      const uploadResults: {
        idx: number;
        blobKey: string;
        cdnUrl: string;
        file: File;
        caption: string;
        imageDate: string;
      }[] = [];
      const uploadErrors: string[] = [];

      await Promise.all(
        sasRes.uploads.map(async (target, idx) => {
          const pending = pendingUploads[idx];
          try {
            const blockBlobClient = new BlockBlobClient(target.sasUrl);

            await blockBlobClient.uploadData(pending.file, {
              blobHTTPHeaders: {
                blobContentType: pending.file.type || 'application/octet-stream',
                blobCacheControl: 'public, max-age=86400',
              },
              blockSize: 4 * 1024 * 1024,       // 4 MB blocks
              concurrency: 4,                    // parallel block uploads
              onProgress: (ev) => {
                const pct = Math.round(
                  ((ev.loadedBytes || 0) / pending.file.size) * 100
                );
                setPendingUploads((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, progress: Math.min(pct, 100) } : p))
                );
              },
            });

            // Mark done
            setPendingUploads((prev) =>
              prev.map((p, i) => (i === idx ? { ...p, status: 'done' as const, progress: 100 } : p))
            );

            uploadResults.push({
              idx,
              blobKey: target.blobKey,
              cdnUrl: target.cdnUrl,
              file: pending.file,
              caption: pending.caption,
              imageDate: pending.imageDate,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            setPendingUploads((prev) =>
              prev.map((p, i) =>
                i === idx ? { ...p, status: 'error' as const, error: msg } : p
              )
            );
            uploadErrors.push(`${pending.file.name}: ${msg}`);
          }
        })
      );

      // Step 3: Register metadata in backend DB
      if (uploadResults.length > 0) {
        const registerReq: GalleryRegisterRequest = {
          images: uploadResults.map((r) => ({
            blobKey: r.blobKey,
            cdnUrl: r.cdnUrl,
            fileName: r.file.name,
            contentType: r.file.type || 'application/octet-stream',
            sizeBytes: r.file.size,
            caption: r.caption || null,
            imageDate: r.imageDate || null,
          })),
        };

        const regResult = await apiFetch<GalleryUploadResponse>(
          '/api/gallery/images/register',
          { method: 'POST', body: registerReq }
        );

        if (regResult.errors?.length > 0) {
          uploadErrors.push(...regResult.errors);
        }
      }

      // Show result
      if (uploadErrors.length > 0 && uploadResults.length === 0) {
        setSnackbar({ message: `All uploads failed: ${uploadErrors.join('; ')}`, severity: 'error' });
      } else if (uploadErrors.length > 0) {
        setSnackbar({
          message: `Uploaded ${uploadResults.length} files. Errors: ${uploadErrors.join('; ')}`,
          severity: 'success',
        });
      } else {
        setSnackbar({
          message: `Successfully uploaded ${uploadResults.length} photo${uploadResults.length !== 1 ? 's' : ''}!`,
          severity: 'success',
        });
      }

      // Cleanup
      pendingUploads.forEach((p) => URL.revokeObjectURL(p.preview));
      setPendingUploads([]);
      setUploadOpen(false);
      await loadImages();
    } catch (err) {
      setSnackbar({
        message: err instanceof Error ? err.message : 'Upload failed',
        severity: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  // ── Edit / Delete ───────────────────────────────────────────

  // ── Tag search (debounced) ──────────────────────────────────────────

  const tagSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tagSearch.trim().length < 2) {
      setTagSearchResults([]);
      return;
    }
    if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current);
    tagSearchTimer.current = setTimeout(async () => {
      setTagSearchLoading(true);
      try {
        const results = await apiFetch<PersonSearchResult[]>(
          `/api/people/search?q=${encodeURIComponent(tagSearch.trim())}&limit=10`
        );
        // Filter out already-tagged people
        const taggedIds = new Set(editTags.map((t) => t.personId));
        setTagSearchResults(results.filter((r) => !taggedIds.has(r.personId)));
      } catch {
        setTagSearchResults([]);
      } finally {
        setTagSearchLoading(false);
      }
    }, 300);
    return () => { if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current); };
  }, [tagSearch, editTags]);

  const handleAddTag = async (person: PersonSearchResult) => {
    if (!editImage) return;
    try {
      const updatedTags = await apiFetch<ImageTag[]>(`/api/gallery/images/${editImage.id}/tags`, {
        method: 'POST',
        body: { personId: person.personId },
      });
      setEditTags(updatedTags);
      // Update the image in the main list too
      setImages((prev) => prev.map((img) => img.id === editImage.id ? { ...img, tags: updatedTags } : img));
      setTagSearch('');
      setTagSearchResults([]);
    } catch {
      setSnackbar({ message: 'Failed to add tag', severity: 'error' });
    }
  };

  const handleRemoveTag = async (personId: number) => {
    if (!editImage) return;
    try {
      const updatedTags = await apiFetch<ImageTag[]>(`/api/gallery/images/${editImage.id}/tags/${personId}`, {
        method: 'DELETE',
      });
      setEditTags(updatedTags);
      setImages((prev) => prev.map((img) => img.id === editImage.id ? { ...img, tags: updatedTags } : img));
    } catch {
      setSnackbar({ message: 'Failed to remove tag', severity: 'error' });
    }
  };

  const openEdit = (img: GalleryImage) => {
    setEditImage(img);
    setEditCaption(img.caption || '');
    setEditDate(img.imageDate || '');
    setEditTags(img.tags || []);
    setTagSearch('');
    setTagSearchResults([]);
  };

  const saveEdit = async () => {
    if (!editImage) return;
    setEditSaving(true);
    try {
      await apiFetch<unknown>(`/api/gallery/images/${editImage.id}`, {
        method: 'PUT',
        body: { caption: editCaption || null, imageDate: editDate || null } as GalleryUpdateRequest,
      });
      setEditImage(null);
      setSnackbar({ message: 'Image updated', severity: 'success' });
      await loadImages();
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Update failed', severity: 'error' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (img: GalleryImage) => {
    if (!confirm(`Delete "${img.fileName}"? This cannot be undone.`)) return;
    try {
      await apiFetch<unknown>(`/api/gallery/images/${img.id}`, { method: 'DELETE' });
      setSnackbar({ message: 'Image deleted', severity: 'success' });
      await loadImages();
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Delete failed', severity: 'error' });
    }
  };

  // ── Selection helpers (admin bulk-delete) ────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedImages.map((img) => img.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected image${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const body: GalleryDeleteBatchRequest = { ids: Array.from(selectedIds) };
      await apiFetch<unknown>('/api/gallery/images/delete-batch', {
        method: 'POST',
        body,
      });
      setSnackbar({ message: `Deleted ${selectedIds.size} image${selectedIds.size !== 1 ? 's' : ''}`, severity: 'success' });
      exitSelectMode();
      await loadImages();
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : 'Bulk delete failed', severity: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────

  const currentLightboxImage = sortedImages[lightboxIdx];

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch { return d; }
  };

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom>Family Photos</Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        A collection of cherished family moments throughout the years.
      </Typography>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
        {/* View mode */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="grid-sm" aria-label="Small grid">
            <Tooltip title="Small grid"><GridViewIcon /></Tooltip>
          </ToggleButton>
          <ToggleButton value="grid-lg" aria-label="Large grid">
            <Tooltip title="Large grid"><ViewModuleIcon /></Tooltip>
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <Tooltip title="List"><ViewListIcon /></Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel><SortIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <MenuItem value="date-desc">Photo Date (Newest)</MenuItem>
            <MenuItem value="date-asc">Photo Date (Oldest)</MenuItem>
            <MenuItem value="uploaded-desc">Uploaded (Newest)</MenuItem>
            <MenuItem value="uploaded-asc">Uploaded (Oldest)</MenuItem>
            <MenuItem value="name-asc">File Name (A-Z)</MenuItem>
          </Select>
        </FormControl>

        {/* Slideshow */}
        {sortedImages.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<SlideshowIcon />}
            onClick={startSlideshow}
          >
            Slideshow
          </Button>
        )}

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Admin: Upload */}
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadOpen(true)}
          >
            Upload Photos
          </Button>
        )}

        {/* Admin: Select mode toggle */}
        {isAdmin && sortedImages.length > 0 && !selectMode && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<CheckBoxOutlineBlankIcon />}
            onClick={() => setSelectMode(true)}
          >
            Select
          </Button>
        )}
      </Box>

      {/* ── Selection toolbar (shown when select mode active) ─── */}
      {selectMode && (
        <Box
          sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, p: 1.5,
            alignItems: 'center',
            bgcolor: 'var(--color-primary-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-primary-200)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>
            {selectedIds.size} of {sortedImages.length} selected
          </Typography>

          <Button
            size="small"
            startIcon={<SelectAllIcon />}
            onClick={selectAll}
            disabled={selectedIds.size === sortedImages.length}
          >
            Select All
          </Button>

          {selectedIds.size > 0 && (
            <Button
              size="small"
              startIcon={<DeselectIcon />}
              onClick={deselectAll}
            >
              Deselect All
            </Button>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={bulkDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || bulkDeleting}
          >
            {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size > 0 ? selectedIds.size : ''}`}
          </Button>

          <Button
            size="small"
            onClick={exitSelectMode}
          >
            Cancel
          </Button>
        </Box>
      )}

      {/* Image count */}
      {!loading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {sortedImages.length} {sortedImages.length === 1 ? 'photo' : 'photos'}
        </Typography>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button size="small" onClick={loadImages} sx={{ ml: 2 }}>Retry</Button>
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && sortedImages.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <PhotoLibraryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No photos yet
          </Typography>
          {isAdmin && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Click &ldquo;Upload Photos&rdquo; to add family photos to the gallery.
            </Typography>
          )}
        </Paper>
      )}

      {/* ── Gallery Grid / List ──────────────────────────────── */}
      {!loading && sortedImages.length > 0 && viewMode !== 'list' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid-sm'
              ? 'repeat(auto-fill, minmax(180px, 1fr))'
              : 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 2,
          }}
        >
          {sortedImages.map((img, idx) => (
            <Paper
              key={img.id}
              elevation={1}
              sx={{
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: selectMode ? 'none' : 'scale(1.02)', boxShadow: selectMode ? 1 : 4 },
                position: 'relative',
                outline: selectMode && selectedIds.has(img.id) ? '3px solid var(--color-primary-500)' : 'none',
                outlineOffset: '-3px',
              }}
              onClick={() => selectMode ? toggleSelect(img.id) : openLightbox(idx)}
            >
              <Box
                sx={{
                  position: 'relative',
                  paddingTop: viewMode === 'grid-sm' ? '100%' : '66.67%',
                  overflow: 'hidden',
                }}
              >
                {isVideoContent(img.contentType) ? (
                  <>
                    <video
                      src={img.cdnUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 6,
                        right: 6,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                      }}
                    >
                      VIDEO
                    </Box>
                  </>
                ) : (
                  <img
                    src={img.cdnUrl}
                    alt={img.caption || img.fileName}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </Box>
              {(img.caption || img.imageDate || (img.tags && img.tags.length > 0)) && (
                <Box sx={{ p: 1 }}>
                  {img.caption && (
                    <Typography variant="body2" noWrap title={img.caption}>
                      {img.caption}
                    </Typography>
                  )}
                  {img.imageDate && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(img.imageDate)}
                    </Typography>
                  )}
                  {img.tags && img.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {img.tags.map((tag) => (
                        <Chip
                          key={tag.personId}
                          icon={<PersonIcon sx={{ fontSize: 14 }} />}
                          label={tag.displayName}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); window.location.href = `/profile/${tag.personId}`; }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}
              {/* Admin controls on hover */}
              {isAdmin && !selectMode && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    display: 'flex',
                    gap: 0.5,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '.MuiPaper-root:hover &': { opacity: 1 },
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.85)' }}
                    onClick={(e) => { e.stopPropagation(); openEdit(img); }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.85)' }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(img); }}
                  >
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              )}
              {/* Selection checkbox overlay */}
              {selectMode && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    zIndex: 2,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedIds.has(img.id)
                    ? <CheckBoxIcon sx={{ color: 'var(--color-primary-500)' }} />
                    : <CheckBoxOutlineBlankIcon sx={{ color: 'var(--color-gray-400)' }} />}
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* ── List View ────────────────────────────────────────── */}
      {!loading && sortedImages.length > 0 && viewMode === 'list' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {sortedImages.map((img, idx) => (
            <Paper
              key={img.id}
              elevation={1}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                outline: selectMode && selectedIds.has(img.id) ? '2px solid var(--color-primary-500)' : 'none',
                outlineOffset: '-2px',
              }}
              onClick={() => selectMode ? toggleSelect(img.id) : openLightbox(idx)}
            >
              <Box sx={{ width: 80, height: 60, position: 'relative', flexShrink: 0, borderRadius: 1, overflow: 'hidden' }}>
                {selectMode && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      zIndex: 2,
                      bgcolor: 'rgba(255,255,255,0.9)',
                      borderRadius: '50%',
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedIds.has(img.id)
                      ? <CheckBoxIcon sx={{ fontSize: 20, color: 'var(--color-primary-500)' }} />
                      : <CheckBoxOutlineBlankIcon sx={{ fontSize: 20, color: 'var(--color-gray-400)' }} />}
                  </Box>
                )}
                {isVideoContent(img.contentType) ? (
                  <video
                    src={img.cdnUrl}
                    muted
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={img.cdnUrl}
                    alt={img.caption || img.fileName}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body1" noWrap>
                  {img.caption || img.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {img.imageDate ? formatDate(img.imageDate) : 'No date'}
                  {' · '}
                  {(img.sizeBytes / 1024).toFixed(0)} KB
                </Typography>
                {img.tags && img.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {img.tags.map((tag) => (
                      <Chip
                        key={tag.personId}
                        icon={<PersonIcon sx={{ fontSize: 14 }} />}
                        label={tag.displayName}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); window.location.href = `/profile/${tag.personId}`; }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
              {isAdmin && !selectMode && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(img); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(img); }}>
                    <DeleteIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* ═══ Lightbox ════════════════════════════════════════ */}
      <Dialog
        open={lightboxOpen}
        onClose={closeLightbox}
        maxWidth={false}
        fullScreen
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)' } }}
      >
        {currentLightboxImage && (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Top bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="white">
                  {lightboxIdx + 1} / {sortedImages.length}
                </Typography>
                {currentLightboxImage.caption && (
                  <Chip label={currentLightboxImage.caption} size="small" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined" />
                )}
                {currentLightboxImage.imageDate && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {formatDate(currentLightboxImage.imageDate)}
                  </Typography>
                )}
                {currentLightboxImage.tags && currentLightboxImage.tags.length > 0 && (
                  <>
                    <Box sx={{ mx: 0.5, width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.3)' }} />
                    {currentLightboxImage.tags.map((tag) => (
                      <Chip
                        key={tag.personId}
                        icon={<PersonIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8) !important' }} />}
                        label={tag.displayName}
                        size="small"
                        variant="outlined"
                        component={Link}
                        href={`/profile/${tag.personId}`}
                        clickable
                        sx={{
                          color: 'white',
                          borderColor: 'rgba(255,255,255,0.3)',
                          '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.1)' },
                          textDecoration: 'none',
                        }}
                      />
                    ))}
                  </>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Slideshow controls */}
                <Tooltip title={slideshowMode === 'sequential' ? 'Sequential' : 'Shuffle'}>
                  <IconButton
                    sx={{ color: 'white' }}
                    onClick={() => setSlideshowMode((m) => (m === 'sequential' ? 'shuffle' : 'sequential'))}
                  >
                    {slideshowMode === 'sequential' ? <RepeatIcon /> : <ShuffleIcon />}
                  </IconButton>
                </Tooltip>

                <Tooltip title={slideshowActive ? 'Pause slideshow' : 'Play slideshow'}>
                  <IconButton
                    sx={{ color: 'white' }}
                    onClick={() => (slideshowActive ? stopSlideshow() : startSlideshow())}
                  >
                    {slideshowActive ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                </Tooltip>

                <IconButton sx={{ color: 'white' }} onClick={closeLightbox}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Image area */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              {/* Prev */}
              <IconButton
                sx={{
                  position: 'absolute',
                  left: 8,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.3)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                  zIndex: 1,
                }}
                onClick={lightboxPrev}
              >
                <ArrowBackIosNewIcon />
              </IconButton>

              <Fade in key={currentLightboxImage.id} timeout={400}>
                {isVideoContent(currentLightboxImage.contentType) ? (
                  <video
                    src={currentLightboxImage.cdnUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      maxWidth: '90vw',
                      maxHeight: 'calc(100vh - 120px)',
                      objectFit: 'contain',
                      borderRadius: '4px',
                    }}
                  />
                ) : (
                  <img
                    src={currentLightboxImage.cdnUrl}
                    alt={currentLightboxImage.caption || currentLightboxImage.fileName}
                    style={{
                      maxWidth: '90vw',
                      maxHeight: 'calc(100vh - 120px)',
                      objectFit: 'contain',
                      borderRadius: '4px',
                    }}
                  />
                )}
              </Fade>

              {/* Next */}
              <IconButton
                sx={{
                  position: 'absolute',
                  right: 8,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.3)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                  zIndex: 1,
                }}
                onClick={lightboxNext}
              >
                <ArrowForwardIosIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* ═══ Upload Dialog ═══════════════════════════════════ */}
      <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Family Photos</DialogTitle>
        <DialogContent>
          {/* File selection buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<PhotoLibraryIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Select Images
            </Button>
            <Button
              variant="outlined"
              startIcon={<CreateNewFolderIcon />}
              onClick={() => folderInputRef.current?.click()}
            >
              Select Folder
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Supported: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV — no size limit (chunked upload)
            </Typography>
          </Box>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            multiple
            hidden
            onChange={(e) => addFilesToPending(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime"
            multiple
            hidden
            /* @ts-expect-error — webkitdirectory is not in the type defs */
            webkitdirectory=""
            onChange={(e) => addFilesToPending(e.target.files)}
          />

          {/* Pending uploads list */}
          {pendingUploads.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {pendingUploads.length} {pendingUploads.length === 1 ? 'file' : 'files'} selected
            </Typography>
          )}

          <Box sx={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {pendingUploads.map((p, idx) => (
              <Paper key={idx} variant="outlined" sx={{ display: 'flex', gap: 2, p: 1.5, alignItems: 'flex-start', opacity: p.status === 'done' ? 0.6 : 1 }}>
                {/* Preview thumbnail */}
                <Box sx={{ width: 80, height: 60, flexShrink: 0, borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
                  {isVideoFile(p.file) ? (
                    <>
                      <video
                        src={p.preview}
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <Box sx={{ position: 'absolute', bottom: 2, left: 2, bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 0.5, borderRadius: 0.5, fontSize: '0.6rem', lineHeight: 1.2 }}>VIDEO</Box>
                    </>
                  ) : (
                    <img
                      src={p.preview}
                      alt={p.file.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </Box>

                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" noWrap title={p.file.name}>
                    {p.file.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({p.file.size >= 1024 * 1024
                        ? `${(p.file.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(p.file.size / 1024).toFixed(0)} KB`})
                    </Typography>
                    {p.status === 'done' && (
                      <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                        ✓ Done
                      </Typography>
                    )}
                    {p.status === 'error' && (
                      <Typography component="span" variant="caption" color="error" sx={{ ml: 1 }}>
                        ✗ {p.error}
                      </Typography>
                    )}
                  </Typography>

                  {p.status === 'uploading' && (
                    <LinearProgress variant="determinate" value={p.progress} sx={{ borderRadius: 1 }} />
                  )}

                  {p.status === 'pending' && (
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <TextField
                        size="small"
                        label="Caption"
                        value={p.caption}
                        onChange={(e) => updatePending(idx, 'caption', e.target.value)}
                        sx={{ flex: 2 }}
                      />
                      <TextField
                        size="small"
                        label="Date"
                        type="date"
                        value={p.imageDate}
                        onChange={(e) => updatePending(idx, 'imageDate', e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  )}
                </Box>

                <IconButton size="small" onClick={() => removePending(idx)} disabled={uploading}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Paper>
            ))}
          </Box>

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Uploading {pendingUploads.filter((p) => p.status === 'done').length} / {pendingUploads.length} files directly to Azure...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  pendingUploads.length > 0
                    ? pendingUploads.reduce((acc, p) => acc + p.progress, 0) / pendingUploads.length
                    : 0
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={pendingUploads.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={18} /> : <CloudUploadIcon />}
          >
            {uploading ? 'Uploading…' : `Upload ${pendingUploads.length} File${pendingUploads.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Edit Dialog ═════════════════════════════════════ */}
      <Dialog open={!!editImage} onClose={() => !editSaving && setEditImage(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Photo</DialogTitle>
        <DialogContent>
          {editImage && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ textAlign: 'center' }}>
                {isVideoContent(editImage.contentType) ? (
                  <video
                    src={editImage.cdnUrl}
                    controls
                    muted
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
                  />
                ) : (
                  <img
                    src={editImage.cdnUrl}
                    alt={editImage.caption || editImage.fileName}
                    style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 4 }}
                  />
                )}
              </Box>
              <TextField
                label="Caption"
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                fullWidth
              />
              <TextField
                label="Photo Date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />

              {/* ── Tag People ── */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalOfferIcon fontSize="small" /> Tagged People
                </Typography>
                {editTags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {editTags.map((tag) => (
                      <Chip
                        key={tag.personId}
                        icon={<PersonIcon sx={{ fontSize: 16 }} />}
                        label={tag.displayName}
                        onDelete={() => handleRemoveTag(tag.personId)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
                <Autocomplete
                  freeSolo
                  options={tagSearchResults}
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.displayName
                  }
                  inputValue={tagSearch}
                  onInputChange={(_, val) => setTagSearch(val)}
                  onChange={(_, val) => {
                    if (val && typeof val !== 'string') {
                      handleAddTag(val);
                    }
                  }}
                  loading={tagSearchLoading}
                  filterOptions={(x) => x}
                  renderOption={(props, option) => (
                    <li {...props} key={typeof option === 'string' ? option : option.personId}>
                      <PersonIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                      {typeof option === 'string' ? option : option.displayName}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search people to tag…"
                      size="small"
                      placeholder="Type a name"
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {tagSearchLoading ? <CircularProgress color="inherit" size={18} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                  noOptionsText={tagSearch.length < 2 ? 'Type at least 2 characters' : 'No people found'}
                  size="small"
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditImage(null)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Snackbar ════════════════════════════════════════ */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
