'use client';

import { Box, Typography, Stack } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Ellen Scott Phillips">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{
          width: { xs: '100%', sm: 200 }, height: 230, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/ellen-scott-phillips.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            Ellen Scott was born in 1881 in Tillman, South Carolina to parents Marcus and Caroline Scott.
            In her early youth, she was united in holy matrimony to Henry Phillips. They were blessed
            with ten children. Following the death of her husband, Ellen moved to Chatham County and
            placed her membership with the Macedonia Baptist Church in 1920. She was a faithful and
            ardent worker, serving as an officer in the Home Mission Society and other affiliations.
            She lived a full life.
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 1, fontStyle: 'italic' }}>
            (Reference: Ellen Scott Phillips Obituary, 1968)
          </Typography>
        </Box>
      </Stack>

      <SectionTitle>Ellen Scott Phillips Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Notes</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/ellen-scott-phillips.pdf" target="_blank" rel="noopener noreferrer">Ellen Scott Phillips</a></strong><br/>
                Born: Sep 11, 1881<br/>Died: Jan 10, 1968
              </td>
              <td>Married<br/><strong>John Henry Phillips</strong></td>
              <td>&mdash;</td>
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
              <td>
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/johnny-h-phillips-obituary.pdf" target="_blank" rel="noopener noreferrer">John Henry II</a></strong><br/>
                Born: Nov 4, 1902<br/>Died: Aug 7, 1979
              </td>
              <td>
                <a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/agnes-dora-riley-phillips-obituary.pdf" target="_blank" rel="noopener noreferrer">Agnes Idora Riley Phillips</a><br/>
                Born: Oct 30, 1904<br/>Died: Apr 9, 2003
              </td>
              <td>John Henry Phillips III</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
