'use client';

import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Global loading state — shown by Next.js App Router while navigating between pages.
 */
export default function Loading() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Loading...
      </Typography>
    </Box>
  );
}
