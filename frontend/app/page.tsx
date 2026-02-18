'use client';

import Link from 'next/link';
import { Typography, Box, Button, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CelebrationIcon from '@mui/icons-material/Celebration';
import HistoryIcon from '@mui/icons-material/History';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useState } from 'react';
import { useFamilyName } from './lib/FamilyNameContext';
import { useAuth } from './lib/useAuth';
import HeroSlideshow from './components/HeroSlideshow';

export default function Home() {
  const { family, full } = useFamilyName();

  const HIGHLIGHTS = [
    {
      icon: <CelebrationIcon sx={{ fontSize: 32, color: 'var(--color-primary-500)' }} />,
      title: 'Annual Reunion',
      description: 'Every third Sunday of July we gather to celebrate our heritage and strengthen family bonds.',
      href: '/reunion',
    },
    {
      icon: <HistoryIcon sx={{ fontSize: 32, color: 'var(--color-primary-500)' }} />,
      title: 'Our History',
      description: 'Discover the legacy of Sarah Scott, Marcus A. Scott, and the generations that followed.',
      href: '/history',
    },
    {
      icon: <PhotoLibraryIcon sx={{ fontSize: 32, color: 'var(--color-primary-500)' }} />,
      title: 'Family Photos',
      description: 'Browse and share photos from family gatherings, events, and everyday moments.',
      href: '/memorial/family-photos',
    },
    {
      icon: <AccountTreeIcon sx={{ fontSize: 32, color: 'var(--color-primary-500)' }} />,
      title: 'Family Tree',
      description: `Explore the branches of the ${full} family tree and find your connection.`,
      href: '/family-tree',
    },
  ];

  const { isAdmin } = useAuth();
  const [editMode, setEditMode] = useState(false);

  return (
    <Box>
      {/* ── Full-width slideshow (breaks out of main container) ── */}
      <Box
        sx={{
          width: '100vw',
          position: 'relative',
          left: '50%',
          right: '50%',
          mx: '-50vw',
        }}
      >
        {/* Admin edit mode toggle */}
        {isAdmin && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, py: 0.5, bgcolor: 'var(--color-gray-50)', borderBottom: '1px solid var(--border)' }}>
            <Button
              size="small"
              variant={editMode ? 'contained' : 'outlined'}
              startIcon={<EditIcon />}
              onClick={() => setEditMode(!editMode)}
              sx={editMode ? {
                bgcolor: 'var(--color-primary-500)',
                '&:hover': { bgcolor: 'var(--color-primary-600)' },
              } : {
                borderColor: 'var(--color-primary-500)',
                color: 'var(--color-primary-500)',
                '&:hover': { borderColor: 'var(--color-primary-600)', bgcolor: 'var(--color-primary-50)' },
              }}
            >
              {editMode ? 'Done Editing' : 'Edit Slideshow'}
            </Button>
          </Box>
        )}

        <HeroSlideshow
          isAdmin={isAdmin}
          editMode={editMode}
          family={family}
          full={full}
        />
      </Box>

      {/* CTA buttons */}
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Link href="/reunion">
          <Button
            variant="contained"
            size="large"
            sx={{
              bgcolor: 'var(--color-primary-500)',
              '&:hover': { bgcolor: 'var(--color-primary-600)' },
              px: 4,
              py: 1.25,
            }}
          >
            Reunion Info
          </Button>
        </Link>
        <Link href="/history">
          <Button
            variant="outlined"
            size="large"
            sx={{
              borderColor: 'var(--color-primary-500)',
              color: 'var(--color-primary-500)',
              '&:hover': { borderColor: 'var(--color-primary-600)', bgcolor: 'var(--color-primary-50)' },
              px: 4,
              py: 1.25,
            }}
          >
            Our Story
          </Button>
        </Link>
      </Stack>

      {/* Feature cards grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2.5,
          mt: 4,
          mb: 2,
        }}
      >
        {HIGHLIGHTS.map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <Box
              className="card card-interactive"
              sx={{
                p: 3,
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
                cursor: 'pointer',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  bgcolor: 'var(--color-primary-50)',
                  borderRadius: 'var(--radius-md)',
                  p: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--foreground)', mb: 0.5 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {item.description}
                </Typography>
              </Box>
            </Box>
          </Link>
        ))}
      </Box>
    </Box>
  );
}
