'use client';

import { Typography, Box } from '@mui/material';
import Link from 'next/link';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import { useFamilyName } from '../lib/FamilyNameContext';

export default function Page() {
  const { family, full } = useFamilyName();

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Image Gallery
        </Typography>
      </Box>

      {/* Description card */}
      <Box className="card" sx={{ p: { xs: 3, sm: 5 }, mb: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Browse and share photos from {full} family gatherings, events, and everyday moments.
        </Typography>
      </Box>

      {/* Link card */}
      <Link href="/memorial/family-photos" style={{ textDecoration: 'none' }}>
        <Box className="card card-interactive" sx={{
          p: 4, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
        }}>
          <PhotoLibraryIcon sx={{ fontSize: 36, color: 'var(--color-primary-400)' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
            Family Photos
          </Typography>
        </Box>
      </Link>
    </Box>
  );
}