'use client';

import { Box, Typography, Button, Paper } from '@mui/material';
import Link from 'next/link';

/**
 * Custom 404 page — shown when a route doesn't match any page.
 */
export default function NotFound() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        p: 4,
      }}
    >
      <Paper elevation={2} sx={{ p: 6, textAlign: 'center', maxWidth: 480 }}>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 'bold' }}>
          404
        </Typography>
        <Typography variant="h5" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </Typography>
        <Link href="/" passHref>
          <Button variant="contained" size="large">
            Go Home
          </Button>
        </Link>
      </Paper>
    </Box>
  );
}
