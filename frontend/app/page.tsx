'use client';

import Image from 'next/image';
import { Container, Typography, Box, Paper } from '@mui/material';

export default function Home() {
  return (
    <Container maxWidth="md" sx={{ minHeight: '100vh', py: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom>
          Welcome Scott-Phillips Family!
        </Typography>

        <Typography variant="h5" color="text.secondary" gutterBottom>
          2023 Scott-Phillips Family Reunion Information is Available Here!
        </Typography>

        <Typography variant="body1" paragraph>
          We are the descendants of the slave, Sarah Scott. We are the descendants of her son, Marcus A. Scott and Caroline Wright Scott.
          We are family. Let us continue to gather together and strengthen our family ties as our ancestors have done for many years before us.
        </Typography>

        <Box sx={{ my: 4, display: 'flex', justifyContent: 'center' }}>
          <Image
            src="/images/sarahscott1 (1).jpg"
            alt="Sarah Scott"
            width={400}
            height={300}
            style={{ borderRadius: '12px', objectFit: 'cover' }}
            priority
          />
        </Box>
      </Paper>
    </Container>
  );
}
