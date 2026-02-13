'use client';

import { Box, Typography } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Jeff Scott">
      <Box sx={{
        width: 200, height: 275, borderRadius: 'var(--radius-lg)',
        overflow: 'hidden', mb: 3,
        backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2012/10/unclejeffscott-w300h414.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} />

      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', fontStyle: 'italic', mb: 3 }}>
        Thomas Jefferson Scott — limited records available.
      </Typography>

      <SectionTitle>Jeff Scott Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong>Jeff Scott</strong><br />
                Born: Unknown<br />
                Died: Unknown
              </td>
              <td>Married<br /><strong>Mary Mitchell</strong></td>
              <td>James, Mary Ann</td>
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
              <td><strong>James</strong></td>
              <td>Unknown</td>
              <td>&mdash;</td>
            </tr>
            <tr>
              <td><strong>Mary Ann</strong></td>
              <td>Unknown</td>
              <td>&mdash;</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
