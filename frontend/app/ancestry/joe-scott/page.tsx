'use client';

import { Box, Typography, Stack } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Joe Scott">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{
          width: { xs: '100%', sm: 200 }, height: 210, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/joe-scott.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            Joe Emanuel Scott was born on May 3, 1898, to Mr. and Mrs. Marcus Scott in Tillman,
            South Carolina. He spent most of his life in Ludowici, Georgia, where he joined the
            Macedonia Baptist Church. In 1918, he was joined in Holy Matrimony to Miss Francina
            Slater, who preceded him in death. From this union, one child was born, Norman Scott, Sr.
            Before his health failed, he was employed by the Fort Stewart Civil Service Department.
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 1, fontStyle: 'italic' }}>
            (Reference: Joe Scott Obituary, 1981)
          </Typography>
        </Box>
      </Stack>

      <SectionTitle>Descendants of Joe Scott</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/joe-scott-obituary.pdf" target="_blank" rel="noopener noreferrer">Joe Scott</a></strong><br />
                Born: May 3, 1898<br />
                Died: Jan 28, 1981
              </td>
              <td>Married<br /><strong>Francis Slater</strong></td>
              <td>Norman Scott, Sr</td>
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
                <Box sx={{
                  width: 100, height: 130, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', mb: 1,
                  backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/10429460_10202799723096335_3228710296943715290_n.jpg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                <strong>Norman Scott, Sr</strong><br />
                Born: Aug 7, 1919<br />
                Died: May 21, 2003
              </td>
              <td>
                <Box sx={{
                  width: 100, height: 130, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', mb: 1,
                  backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/12/690.jpg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                Married July 2, 1944<br />
                <strong>Helen Waye</strong><br />
                Born: 1925
              </td>
              <td>
                Lois, Rena, Henry Lee, Larry, Samuel, Edna Mae, Rudolph, Randolph, Howard, Brunell, Vella Gene, Norman Jr.
              </td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
