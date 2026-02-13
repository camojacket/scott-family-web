'use client';

import { Box, Typography, Stack } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Marcus A. Scott">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <Box sx={{
          width: { xs: '100%', sm: 220 }, height: 215, borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', flexShrink: 0,
          backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/marcus.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <Box>
          <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            Marcus A. Scott was born February 2, 1890, in Tarboro, South Carolina, to Marcus and
            Caroline Scott. He married Maggie Williams, also a native of South Carolina. In 1910, he
            and his family moved to Long County, Georgia. He joined Macedonia Baptist Church in 1919
            and was elected church clerk in 1934. He was ordained as a deacon and served as
            superintendent of the Sunday School from 1940&ndash;1949, at which time he moved to
            Florida. He became an ordained minister at Mt. Sinai Baptist Church in Gifford, FL. After
            returning to Long County, he served as assistant pastor of Mt. Zion Baptist Church and as
            a Bible teacher in the Ludowici District Union. He was a farmer and owned his own farm.
            After the death of Maggie Scott, Marcus married Lena Rountree in May of 1929. Marcus and
            Lena held many family reunions and started a tradition that we have carried on to this day.
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 1, fontStyle: 'italic' }}>
            Please add to Marcus Scott&apos;s bio! E-mail{' '}
            <a href="mailto:scott_phillips_family@yahoo.com" style={{ color: 'var(--color-primary-500)' }}>
              scott_phillips_family@yahoo.com
            </a>.
          </Typography>
        </Box>
      </Stack>

      <SectionTitle>Descendants of Marcus A. Scott</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/marcus-a-scott-obituary.pdf" target="_blank" rel="noopener noreferrer">Marcus A. Scott</a></strong><br />
                (1890&ndash;1977)
              </td>
              <td>
                1st wife: <strong>Maggie Scott</strong><br />
                2nd wife: <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/lena-scott-obituary.pdf" target="_blank" rel="noopener noreferrer">Lena Scott</a></strong><br />
                (1904&ndash;1972)
              </td>
              <td>Allen, Victoria, Grace, Obidiah, Lewis, Marcus III, James, Louise</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>

      <SectionTitle>Marcus A. Scott Children</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Child</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <Box sx={{
                  width: 80, height: 120, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', mb: 1,
                  backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/12/allen-scott.jpg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                <strong>Allen Scott</strong>
              </td>
              <td>
                Married<br />
                <a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/scan0018.jpg" target="_blank" rel="noopener noreferrer">Johnnie Mae Scott Allen</a><br />
                (1921&ndash;2010)
              </td>
              <td>Sarah Victoria (1937&ndash;1978), Allen Jr (1941&ndash;2000), Ernest, Evelina, Elijah (1939&ndash;2013), Frank, Johnny</td>
            </tr>
            <tr>
              <td><strong>Victoria Scott Nephew</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Grace Scott Bradley</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Obidiah Scott</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Lewis Scott</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Marcus Scott III</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>James Scott</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Louise Williams</strong></td>
              <td>&mdash;</td>
              <td>&mdash;</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
