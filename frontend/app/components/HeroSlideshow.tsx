'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Image from './CdnImage';
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Button,
  Snackbar,
  Alert,
  Tooltip,
  CircularProgress,
  TextField,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import TimerIcon from '@mui/icons-material/Timer';
import { apiFetch } from '../lib/api';
import { BlockBlobClient } from '@azure/storage-blob';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

function isVideoUrl(url: string, type?: string): boolean {
  if (type === 'video') return true;
  if (type === 'image') return false;
  const lower = url.toLowerCase().split('?')[0];
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

interface SlideMedia {
  url: string;
  caption: string;
  order: number;
  type?: string; // 'image' | 'video'
  duration?: number; // seconds per slide
}

interface HeroSlideshowProps {
  isAdmin: boolean;
  editMode: boolean;
  family: string;
  full: string;
}

const DEFAULT_SLIDE_DURATION = 6; // seconds

export default function HeroSlideshow({ isAdmin, editMode, family }: HeroSlideshowProps) {
  const [slides, setSlides] = useState<SlideMedia[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [draftCaption, setDraftCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [editingDuration, setEditingDuration] = useState<number | null>(null);
  const [draftDuration, setDraftDuration] = useState('');
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const loadSlides = useCallback(async () => {
    try {
      const data = await apiFetch<SlideMedia[]>('/api/slideshow');
      if (data.length > 0) {
        setSlides(data);
      }
    } catch {
      // silent — will show nothing if no images
    }
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Auto-advance slideshow (per-slide duration)
  useEffect(() => {
    if (slides.length <= 1) return;
    const currentSlide = slides[currentIndex];
    const durationMs = (currentSlide?.duration ?? DEFAULT_SLIDE_DURATION) * 1000;
    timerRef.current = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
    }, durationMs);
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current); };
  }, [slides, currentIndex]);

  // Reset audio to muted on slide change
  useEffect(() => {
    setIsMuted(true);
  }, [currentIndex]);

  // Sync muted state to video elements
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      video.muted = idx === currentIndex ? isMuted : true;
    });
  }, [currentIndex, isMuted]);

  function goTo(index: number) {
    setCurrentIndex(index);
  }

  function goNext() {
    goTo((currentIndex + 1) % slides.length);
  }

  function goPrev() {
    goTo((currentIndex - 1 + slides.length) % slides.length);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const contentType = file.type || 'application/octet-stream';
      const mediaType = contentType.startsWith('video/') ? 'video' : 'image';

      // Step 1: Get SAS upload URL from backend
      const sasRes = await apiFetch<{ blobKey: string; sasUrl: string; cdnUrl: string }>(
        '/api/slideshow/sas',
        {
          method: 'POST',
          body: { fileName: file.name, contentType },
        }
      );

      // Step 2: Upload directly to Azure Blob Storage
      const blockBlobClient = new BlockBlobClient(sasRes.sasUrl);
      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=86400',
        },
        blockSize: 4 * 1024 * 1024,
        concurrency: 4,
        onProgress: (ev) => {
          const pct = Math.round(((ev.loadedBytes || 0) / file.size) * 100);
          setUploadProgress(Math.min(pct, 100));
        },
      });

      // Step 3: Register the uploaded media in backend
      const data = await apiFetch<SlideMedia[]>('/api/slideshow/register', {
        method: 'POST',
        body: { url: sasRes.cdnUrl, caption: '', type: mediaType },
      });

      setSlides(data);
      setSnack({ msg: 'Media added to slideshow', severity: 'success' });
    } catch (err) {
      setSnack({ msg: err instanceof Error ? err.message : 'Upload failed', severity: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(index: number) {
    if (slides.length <= 1) {
      setSnack({ msg: 'At least 1 slideshow item is required', severity: 'error' });
      return;
    }
    try {
      const data = await apiFetch<SlideMedia[]>(`/api/slideshow/${index}`, { method: 'DELETE' });
      setSlides(data);
      if (currentIndex >= data.length) setCurrentIndex(Math.max(0, data.length - 1));
      setSnack({ msg: 'Item removed', severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to remove image', severity: 'error' });
    }
  }

  async function handleSaveCaption(index: number) {
    try {
      const data = await apiFetch<SlideMedia[]>(`/api/slideshow/${index}/caption`, {
        method: 'PUT',
        body: { caption: draftCaption },
      });
      setSlides(data);
      setEditingCaption(null);
      setSnack({ msg: 'Caption saved', severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to save caption', severity: 'error' });
    }
  }

  async function handleSaveDuration(index: number) {
    const dur = parseInt(draftDuration, 10);
    if (isNaN(dur) || dur < 1) {
      setSnack({ msg: 'Duration must be at least 1 second', severity: 'error' });
      return;
    }
    try {
      const data = await apiFetch<SlideMedia[]>(`/api/slideshow/${index}/duration`, {
        method: 'PUT',
        body: { duration: dur },
      });
      setSlides(data);
      setEditingDuration(null);
      setSnack({ msg: 'Duration saved', severity: 'success' });
    } catch {
      setSnack({ msg: 'Failed to save duration', severity: 'error' });
    }
  }

  if (slides.length === 0) return null;

  const current = slides[currentIndex] || slides[0];

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── Slideshow container ── */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: 300, sm: 400, md: 500 },
          overflow: 'hidden',
          bgcolor: '#111',
        }}
      >
        {/* Slides */}
        {slides.map((slide, i) => (
          <Box
            key={slide.url}
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: i === currentIndex ? 1 : 0,
              transition: 'opacity 1s ease-in-out',
              zIndex: i === currentIndex ? 1 : 0,
            }}
          >
            {isVideoUrl(slide.url, slide.type) ? (
              <Box
                component="video"
                ref={(el: HTMLVideoElement | null) => {
                  if (el) videoRefs.current.set(i, el);
                  else videoRefs.current.delete(i);
                }}
                src={slide.url}
                autoPlay
                muted
                loop
                playsInline
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <Image
                src={slide.url}
                alt={slide.caption || `Slide ${i + 1}`}
                fill
                sizes="100vw"
                style={{ objectFit: 'cover' }}
                priority={i === 0}
              />
            )}
          </Box>
        ))}

        {/* Dark gradient overlay for text readability */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Welcome text overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            px: 3,
            pointerEvents: 'none',
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.02em',
              fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
              mb: 2,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            Welcome to the {family}
          </Typography>

          <Typography
            sx={{
              maxWidth: 650,
              color: 'rgba(255,255,255,0.92)',
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              lineHeight: 1.7,
              textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            }}
          >
            We are the descendants of Sarah Scott, through her son Marcus A. Scott and Caroline Wright Scott.
            We are family. Let us continue to gather together and strengthen our family ties as our ancestors
            have done for many years before us.
          </Typography>
        </Box>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <IconButton
              onClick={goPrev}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 4,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
              }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={goNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 4,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
              }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          </>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 4,
            }}
          >
            {slides.map((_, i) => (
              <Box
                key={i}
                onClick={() => goTo(i)}
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s',
                  '&:hover': { bgcolor: '#fff' },
                }}
              />
            ))}
          </Stack>
        )}

        {/* Caption overlay (bottom-left) */}
        {current.caption && (
          <Typography
            sx={{
              position: 'absolute',
              bottom: 40,
              left: 16,
              zIndex: 4,
              color: 'rgba(255,255,255,0.85)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {current.caption}
          </Typography>
        )}

        {/* Speaker icon for video slides */}
        {isVideoUrl(current.url, current.type) && (
          <IconButton
            onClick={() => setIsMuted(prev => !prev)}
            sx={{
              position: 'absolute',
              bottom: 44,
              right: 16,
              zIndex: 4,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.45)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}
          >
            {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
        )}
      </Box>

      {/* ── Admin edit panel (thumbnails) ── */}
      {isAdmin && editMode && (
        <Box
          sx={{
            bgcolor: 'var(--color-gray-50)',
            borderBottom: '1px solid var(--border)',
            px: { xs: 2, sm: 3 },
            py: 2,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'var(--color-primary-700)' }}>
              Slideshow Media ({slides.length}/5)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={uploading ? <CircularProgress size={16} /> : <AddPhotoAlternateIcon />}
              disabled={uploading || slides.length >= 5}
              onClick={() => fileRef.current?.click()}
              sx={{
                borderColor: 'var(--color-primary-500)',
                color: 'var(--color-primary-500)',
                '&:hover': { borderColor: 'var(--color-primary-600)', bgcolor: 'var(--color-primary-50)' },
              }}
            >
              {uploading ? `Uploading... ${uploadProgress}%` : 'Add Media'}
            </Button>
          </Stack>

          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden onChange={handleUpload} />

          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
            {slides.map((slide, i) => (
              <Box
                key={slide.url}
                sx={{
                  position: 'relative',
                  flexShrink: 0,
                  width: 160,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: i === currentIndex ? '2px solid var(--color-primary-500)' : '2px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: 'var(--color-primary-300)' },
                }}
                onClick={() => goTo(i)}
              >
                {/* Thumbnail */}
                {isVideoUrl(slide.url, slide.type) ? (
                  <Box sx={{ position: 'relative', width: '100%', height: 90 }}>
                    <Box
                      component="video"
                      src={slide.url}
                      muted
                      playsInline
                      preload="metadata"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontSize: '0.6rem',
                        px: 0.5,
                        borderRadius: 0.5,
                        fontWeight: 600,
                      }}
                    >
                      VIDEO
                    </Box>
                  </Box>
                ) : (
                  <Box
                    component="img"
                    src={slide.url}
                    alt={slide.caption || `Slide ${i + 1}`}
                    sx={{
                      width: '100%',
                      height: 90,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}

                {/* Info section */}
                <Box sx={{ p: 0.5, bgcolor: '#fff' }}>
                  {editingCaption === i ? (
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      <TextField
                        size="small"
                        value={draftCaption}
                        onChange={e => setDraftCaption(e.target.value)}
                        sx={{ flex: 1, '& input': { fontSize: '0.7rem', py: 0.25, px: 0.5 } }}
                        placeholder="Caption..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveCaption(i);
                          if (e.key === 'Escape') setEditingCaption(null);
                        }}
                        autoFocus
                      />
                      <IconButton size="small" onClick={() => handleSaveCaption(i)} sx={{ width: 20, height: 20 }}>
                        <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setEditingCaption(null)} sx={{ width: 20, height: 20 }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                  ) : editingDuration === i ? (
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      <TextField
                        size="small"
                        type="number"
                        value={draftDuration}
                        onChange={e => setDraftDuration(e.target.value)}
                        sx={{ width: 50, '& input': { fontSize: '0.7rem', py: 0.25, px: 0.5, textAlign: 'center' } }}
                        slotProps={{ htmlInput: { min: 1, max: 300 } }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveDuration(i);
                          if (e.key === 'Escape') setEditingDuration(null);
                        }}
                        autoFocus
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>sec</Typography>
                      <IconButton size="small" onClick={() => handleSaveDuration(i)} sx={{ width: 20, height: 20 }}>
                        <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setEditingDuration(null)} sx={{ width: 20, height: 20 }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slide.caption || '(no caption)'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: 'text.secondary' }}>
                        ⏱ {slide.duration ?? DEFAULT_SLIDE_DURATION}s
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Action bar */}
                <Stack
                  direction="row"
                  justifyContent="space-around"
                  onClick={(e) => e.stopPropagation()}
                  sx={{ bgcolor: '#f5f5f5', borderTop: '1px solid #eee', py: 0.25 }}
                >
                  <Tooltip title="Edit caption">
                    <IconButton
                      size="small"
                      onClick={() => { setEditingCaption(i); setDraftCaption(slide.caption || ''); setEditingDuration(null); }}
                      sx={{ width: 28, height: 28 }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Set duration">
                    <IconButton
                      size="small"
                      onClick={() => { setEditingDuration(i); setDraftDuration(String(slide.duration ?? DEFAULT_SLIDE_DURATION)); setEditingCaption(null); }}
                      sx={{ width: 28, height: 28 }}
                    >
                      <TimerIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={slides.length <= 1 ? 'At least 1 required' : 'Delete'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(i)}
                        disabled={slides.length <= 1}
                        sx={{
                          width: 28,
                          height: 28,
                          color: slides.length > 1 ? 'error.main' : 'action.disabled',
                          '&:hover': slides.length > 1 ? { bgcolor: 'rgba(211,47,47,0.08)' } : {},
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Snackbar */}
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
