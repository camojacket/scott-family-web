'use client';

import { Box, Typography, Alert } from '@mui/material';
import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Mamie Scott Flynn">

      <SectionTitle>Mamie Scott Flynn Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Children</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <Box sx={{
                  width: 120, height: 210, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', mb: 1,
                  backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2022/09/ccbb53d3-b43d-45fe-a9d5-5bbe3e0128ee.jpeg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2022/09/26f4377e-7e5d-4772-abd0-f9d80ac9639f.jpeg" target="_blank" rel="noopener noreferrer">Mamie Scott Flynn</a></strong><br />
                Born: Oct 23, 1887<br />
                Died: Oct 5, 1928
              </td>
              <td>
                <Box sx={{
                  width: 150, height: 170, borderRadius: 'var(--radius-md)',
                  overflow: 'hidden', mb: 1,
                  backgroundImage: 'url(https://scottphillipsfamily.wordpress.com/wp-content/uploads/2022/09/55e5a94b-43b1-4429-9008-feb93954fda0.jpeg)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
                Married<br />
                <strong><a href="https://scottphillipsfamily.wordpress.com/wp-content/uploads/2022/09/cf36f819-c47b-4b54-b453-9518ad0082cb.jpeg" target="_blank" rel="noopener noreferrer">William H. Flynn</a></strong><br />
                Born: May 24, 1872<br />
                Died: Sep 2, 1936
              </td>
              <td>One son (name unknown)</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>

      <Alert severity="info" sx={{ mt: 2, borderRadius: 'var(--radius-md)' }}>
        <Typography variant="body2">
          <strong>Update 9/5/2022</strong> — Death certificates found. Click on names to view.
          If anyone has information on their son, please e-mail{' '}
          <a href="mailto:scott_phillips_family@yahoo.com" style={{ color: 'var(--color-primary-500)' }}>
            scott_phillips_family@yahoo.com
          </a>.
        </Typography>
      </Alert>
    </AncestryLayout>
  );
}
