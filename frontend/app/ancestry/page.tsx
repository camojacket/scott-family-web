'use client';

import { Box, Typography, Stack } from '@mui/material';
import Link from 'next/link';
import PeopleIcon from '@mui/icons-material/People';
import { useFamilyName } from '../lib/FamilyNameContext';

const BRANCHES = [
  { name: 'Ellen Scott Phillips', href: '/ancestry/ellen-scott-phillips', desc: 'Born 1881, married John Henry Phillips' },
  { name: 'Eugene Scott', href: '/ancestry/eugene-scott', desc: 'Born 1898, married Anna "Tiny" Harris' },
  { name: 'Jeff Scott', href: '/ancestry/jeff-scott', desc: 'Thomas Jefferson Scott, married Mary Mitchell' },
  { name: 'Jim Scott', href: '/ancestry/jim-scott', desc: 'Limited records available' },
  { name: 'Joe Scott', href: '/ancestry/joe-scott', desc: 'Born 1898, married Francina Slater' },
  { name: 'Mamie Scott Flynn', href: '/ancestry/mamie-scott-flynn', desc: 'Born 1887, married William H. Flynn' },
  { name: 'Marcus A. Scott', href: '/ancestry/marcus-a-scott', desc: 'Born 1890, married Maggie Williams & Lena Rountree' },
  { name: 'Sandy Scott', href: '/ancestry/sandy-scott', desc: 'John Henry "Sandy" Scott, married Janie Parker' },
  { name: 'Willie Scott', href: '/ancestry/willie-scott', desc: 'Born 1905, "Bill" Scott, lived in Florida' },
];

export default function Page() {
  const { full } = useFamilyName();

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'var(--foreground)' }}>
          Family Ancestry
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
          Explore the branches of the {full} family tree
        </Typography>
      </Box>

      <Stack spacing={2}>
        {BRANCHES.map((b) => (
          <Link key={b.href} href={b.href} style={{ textDecoration: 'none' }}>
            <Box className="card card-interactive" sx={{
              p: 3, display: 'flex', alignItems: 'center', gap: 2.5,
            }}>
              <PeopleIcon sx={{ fontSize: 36, color: 'var(--color-primary-400)', flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontWeight: 700, color: 'var(--foreground)' }}>
                  {b.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  {b.desc}
                </Typography>
              </Box>
            </Box>
          </Link>
        ))}
      </Stack>
    </Box>
  );
}
