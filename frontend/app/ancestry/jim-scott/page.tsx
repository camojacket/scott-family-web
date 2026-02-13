'use client';

import { Typography } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Jim Scott">
      <Typography sx={{ color: 'var(--text-secondary)', lineHeight: 1.8, mb: 3 }}>
        Limited records are available for Jim Scott. If you have information about Jim Scott or his
        descendants, please e-mail{' '}
        <a href="mailto:scott_phillips_family@yahoo.com" style={{ color: 'var(--color-primary-500)' }}>
          scott_phillips_family@yahoo.com
        </a>.
      </Typography>

      <SectionTitle>Jim Scott Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <strong>Jim Scott</strong><br />
                Born: Unknown<br />
                Died: Unknown
              </td>
              <td>Unknown</td>
              <td>Unknown</td>
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
              <td colSpan={3} style={{ textAlign: 'center', fontStyle: 'italic' }}>
                No records available
              </td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
