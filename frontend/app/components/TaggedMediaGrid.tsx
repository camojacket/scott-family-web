'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Dialog, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ArticleIcon from '@mui/icons-material/Article';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { apiFetch } from '../lib/api';
import CdnImage from './CdnImage';

interface GalleryImage {
  id: number;
  cdnUrl: string;
  caption?: string | null;
  imageDate?: string | null;
}

interface Obituary {
  id: number;
  title: string;
  fileUrl: string;
  fileType: 'PDF' | 'IMAGE';
  createdAt?: string | null;
}

type MediaItem =
  | { type: 'image'; data: GalleryImage }
  | { type: 'obituary'; data: Obituary };

/** Extract a sortable date string from a media item (or null if none). */
function getItemDate(item: MediaItem): string | null {
  if (item.type === 'image') return item.data.imageDate ?? null;
  return item.data.createdAt ?? null;
}

interface TaggedMediaGridProps {
  personId: number | string;
}

export default function TaggedMediaGrid({ personId }: TaggedMediaGridProps) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [obituaries, setObituaries] = useState<Obituary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (!personId) return;
    setLoading(true);

    Promise.all([
      apiFetch<GalleryImage[]>(`/api/gallery/images?personId=${personId}`, { method: 'GET' }).catch(() => []),
      apiFetch<Obituary[]>(`/api/obituaries?personId=${personId}`, { method: 'GET' }).catch(() => []),
    ]).then(([imgs, obits]) => {
      setImages(imgs);
      setObituaries(obits);
    }).finally(() => setLoading(false));
  }, [personId]);

  const items: MediaItem[] = useMemo(() => {
    const raw: MediaItem[] = [
      ...images.map((img) => ({ type: 'image' as const, data: img })),
      ...obituaries.map((ob) => ({ type: 'obituary' as const, data: ob })),
    ];

    // Partition into dated and undated
    const dated = raw.filter((i) => !!getItemDate(i));
    const undated = raw.filter((i) => !getItemDate(i));

    // Sort dated items
    dated.sort((a, b) => {
      const da = getItemDate(a)!;
      const db = getItemDate(b)!;
      return sortOrder === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

    // Undated always after dated
    return [...dated, ...undated];
  }, [images, obituaries, sortOrder]);

  const pdfObituaries: Obituary[] = [];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} sx={{ color: 'var(--color-primary-500)' }} />
      </Box>
    );
  }

  if (items.length === 0 && pdfObituaries.length === 0) return null;

  return (
    <Box className="card" sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhotoLibraryIcon sx={{ color: 'var(--color-primary-500)' }} />
          Tagged Media
        </Typography>

        {items.length > 1 && (
          <ToggleButtonGroup
            value={sortOrder}
            exclusive
            size="small"
            onChange={(_, val) => { if (val) setSortOrder(val); }}
            sx={{ ml: 1 }}
          >
            <ToggleButton value="desc" sx={{ px: 1, py: 0.5, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <ArrowDownwardIcon sx={{ fontSize: 16 }} /> Newest
            </ToggleButton>
            <ToggleButton value="asc" sx={{ px: 1, py: 0.5, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}>
              <ArrowUpwardIcon sx={{ fontSize: 16 }} /> Oldest
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Image grid — 3 columns */}
      {items.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
            gap: 1.5,
            mb: pdfObituaries.length > 0 ? 2 : 0,
          }}
        >
          {items.map((item) => {
            const key = item.type === 'image' ? `img-${item.data.id}` : `obit-${item.data.id}`;
            const src = item.type === 'image' ? item.data.cdnUrl : item.data.fileUrl;
            const label = item.type === 'image'
              ? (item.data.caption || item.data.imageDate || 'Photo')
              : item.data.title;

            const isPdf = item.type === 'obituary' && item.data.fileType === 'PDF';

            return (
              <Box
                key={key}
                onClick={() => {
                  if (isPdf) {
                    window.open(src, '_blank');
                  } else {
                    setLightbox(item);
                  }
                }}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'var(--color-gray-100)',
                  '&:hover .overlay': { opacity: 1 },
                }}
              >
                {isPdf ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'var(--color-gray-50)',
                    }}
                  >
                    <PictureAsPdfIcon sx={{ fontSize: 64, color: 'var(--color-gray-300)' }} />
                  </Box>
                ) : (
                  <CdnImage
                    src={src}
                    alt={label}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                )}
                {/* Hover overlay with label */}
                <Box
                  className="overlay"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    p: 1,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#fff',
                      fontWeight: 600,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
                {/* Obituary badge */}
                {item.type === 'obituary' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      bgcolor: 'rgba(0,0,0,0.55)',
                      borderRadius: '50%',
                      p: 0.4,
                      display: 'flex',
                    }}
                  >
                    <ArticleIcon sx={{ color: '#fff', fontSize: 16 }} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* PDF obituaries as links */}
      {pdfObituaries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {pdfObituaries.map((ob) => (
            <Box
              key={ob.id}
              component="a"
              href={ob.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                bgcolor: 'var(--color-primary-50)',
                color: 'var(--color-primary-700)',
                fontWeight: 500,
                fontSize: '0.85rem',
                textDecoration: 'none',
                '&:hover': { bgcolor: 'var(--color-primary-100)' },
              }}
            >
              <ArticleIcon sx={{ fontSize: 18, color: 'var(--color-primary-500)' }} />
              {ob.title}
            </Box>
          ))}
        </Box>
      )}

      {/* Lightbox dialog */}
      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible' },
        }}
      >
        {lightbox && (
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={() => setLightbox(null)}
              sx={{
                position: 'absolute',
                top: -40,
                right: 0,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.5)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                zIndex: 2,
              }}
            >
              <CloseIcon />
            </IconButton>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                maxHeight: '80vh',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#000',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.type === 'image' ? lightbox.data.cdnUrl : lightbox.data.fileUrl}
                alt={
                  lightbox.type === 'image'
                    ? (lightbox.data.caption || 'Photo')
                    : lightbox.data.title
                }
                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              />
            </Box>
            <Typography
              sx={{
                color: '#fff',
                textAlign: 'center',
                mt: 1,
                fontWeight: 500,
                textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              }}
            >
              {lightbox.type === 'image'
                ? (lightbox.data.caption || lightbox.data.imageDate || '')
                : lightbox.data.title}
            </Typography>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
