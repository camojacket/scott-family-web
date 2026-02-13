'use client';

import { Box, Typography, Stack } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Willie &ldquo;Bill&rdquo; Scott">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{
          width: { xs: '100%', sm: 180 }, height: 260, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/bill.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8, mb: 2 }}>
            Willie &ldquo;Bill&rdquo; Scott was born in 1905 in Tarboro, South Carolina. He grew up in
            Ludowici, Georgia in an area known as the Broadlevel. As a young man, he owned a
            store on the Broadlevel. He later moved to Florida during a working season with
            his wife, Mae, and decided to make his home there. He opened another store there
            where he sold general items, including kerosene for heating.
          </Typography>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8, mb: 2 }}>
            His only daughter, Dora, recalls that Bill owned a pet raccoon that was very large and
            never left the yard. Other Scott family members moved to Vero Beach, Florida, following
            Uncle Bill including James, Grace and for a short time, Marcus &ldquo;M.D.&rdquo; Phillips.
            This area was more attractive because it offered more opportunities, more work, and higher pay.
            Many people migrated there for seasonal work, such as tomato, fruit, and bean picking.
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            Please e-mail{' '}
            <a href="mailto:scott_phillips_family@yahoo.com" style={{ color: 'var(--color-primary-500)' }}>
              scott_phillips_family@yahoo.com
            </a>{' '}
            for additions/corrections to this bio.
          </Typography>
        </Box>
      </Stack>

      <SectionTitle>Descendants of Bill Scott</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/willie-e-scott.pdf" target="_blank" rel="noopener noreferrer">Willie &ldquo;Bill&rdquo; Scott</a></strong><br/>
                Born: Jun 18, 1904<br/>Died: Dec 7, 1979
              </td>
              <td>1st: Mae Hill<br/>2nd: Hattie Heyward</td>
              <td>Dora Bullard</td>
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
              <td><strong>Dora Bullard</strong><br/>(1962 &ndash; )</td>
              <td>&mdash;</td>
              <td>Lavar Bullard (1977 &ndash; )</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
