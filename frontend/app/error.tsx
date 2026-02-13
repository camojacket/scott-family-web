'use client';

import { Box, Typography, Button, Paper } from '@mui/material';

/**
 * Global error page — shown when an unhandled error occurs during rendering.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <Typography variant="h5" gutterBottom>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error.message || 'An unexpected error occurred.'}
        </Typography>
        <Button variant="contained" onClick={reset}>
          Try Again
        </Button>
      </Paper>
    </Box>
  );
}
