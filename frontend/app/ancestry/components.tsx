'use client';

import { Box, Typography, Divider } from '@mui/material';

/* ── Reusable styled table for ancestry family trees ──────── */
export function FamilyTable({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      overflowX: 'auto', mb: 3,
      '& table': {
        width: '100%', borderCollapse: 'collapse',
        '& th, & td': {
          p: 1.5, border: '1px solid var(--color-gray-200)',
          verticalAlign: 'top', fontSize: '0.9rem',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        },
        '& th': {
          bgcolor: 'var(--color-primary-50)', fontWeight: 600,
          color: 'var(--color-primary-700)', textAlign: 'left',
        },
        '& a': { color: 'var(--color-primary-500)', textDecoration: 'underline' },
        '& strong': { color: 'var(--foreground)' },
      },
    }}>
      {children}
    </Box>
  );
}

/* ── Section heading ──────────────────────────────────────── */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="h6" sx={{
      fontWeight: 700, color: 'var(--color-primary-700)', mt: 4, mb: 2,
    }}>
      {children}
    </Typography>
  );
}

/* ── Ancestry page shell ──────────────────────────────────── */
export function AncestryLayout({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)', mb: 0.5 }}>
        {name}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      {children}
    </Box>
  );
}
