'use client';

import { Box, Typography, Stack } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Eugene Scott">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{
          width: { xs: '100%', sm: 200 }, height: 200, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/eugene.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            Eugene Scott was born in 1898 in Tarboro, South Carolina. His family moved to
            Ludowici, Georgia in the early 1900s. There, he married Anna &ldquo;Tiny&rdquo; Harris of
            Georgia and they later moved to Savannah and lived there for the remainder of
            their years. Uncle Gene retired from Union Camp Corporation. They had one
            daughter, Betty Jean Scott.
          </Typography>
        </Box>
      </Stack>

      <SectionTitle>Eugene Scott Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Eugene Scott</strong><br/>Born: May 2, 1898<br/>Died: Jan 1, 1981</td>
              <td>Married<br/><strong>Anna Harris</strong></td>
              <td>Betty Scott Ellington</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>

      <SectionTitle>Children</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Child</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Betty Scott Ellington</strong></td>
              <td>1st: &mdash;<br/>2nd: <strong>Russell Ellington</strong><br/>Born: Feb 4, 1938<br/>Died: Sep 1, 2007</td>
              <td>Russell Ellington, Eugene A. Washington Sr., Patricia Mack, Dobson Washington, Larry Washington, Stephanie Nauden</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
