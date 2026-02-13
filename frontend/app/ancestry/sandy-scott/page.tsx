'use client';

import { AncestryLayout, SectionTitle, FamilyTable } from '../components';

export default function Page() {
  return (
    <AncestryLayout name="Sandy Scott">
      <SectionTitle>Sandy Scott Tree</SectionTitle>
      <FamilyTable>
        <table>
          <thead><tr><th>Person</th><th>Spouse</th><th>Notes</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>John Henry &ldquo;Sandy&rdquo; Scott</strong></td>
              <td>Married<br/><strong>Janie Parker</strong></td>
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
              <td><strong>Mamie Scott Henry</strong><br/>Born: Sep 1, 1916<br/>Died: Jul 15, 2006</td>
              <td><a href="https://scottphillipsfamily.wordpress.com/?attachment_id=270" target="_blank" rel="noopener noreferrer">Leroy Henry</a><br/>Born: Jun 9, 1913<br/>Died: Jun 21, 1999</td>
              <td>Leary, Elnora, Leland</td>
            </tr>
            <tr>
              <td><a href="https://scottphillipsfamily.wordpress.com/?attachment_id=260" target="_blank" rel="noopener noreferrer"><strong>Nevelyn Scott Thomas</strong></a><br/>Born: Aug 28, 1925<br/>Died: Apr 1, 2001</td>
              <td>Samuel Thomas</td>
              <td>Rosa</td>
            </tr>
            <tr>
              <td><a href="https://scottphillipsfamily.wordpress.com/?attachment_id=269" target="_blank" rel="noopener noreferrer"><strong>Nellie Mae Scott Miles</strong></a><br/>Born: Apr 6, 1919<br/>Died: Dec 27, 2001</td>
              <td>David Miles</td>
              <td>None</td>
            </tr>
            <tr>
              <td><a href="https://scottphillipsfamily.wordpress.com/?attachment_id=261" target="_blank" rel="noopener noreferrer"><strong>Eva Dell Scott Kelly</strong></a><br/>Born: Jan 24, 1928<br/>Died: Oct 4, 1996</td>
              <td>Nathaniel Kelly</td>
              <td>Timothy, John Henry, Herbert, Ronnie, Jeraldine, Nadine</td>
            </tr>
            <tr>
              <td><strong>Matthew Scott</strong><br/>Born: Nov 15, 1914<br/>Died: Jun 1, 1980</td>
              <td>Evelyn Sullivan</td>
              <td>William</td>
            </tr>
            <tr>
              <td><strong>Albert Scott</strong></td>
              <td><a href="https://scottphillipsfamily.wordpress.com/?attachment_id=259" target="_blank" rel="noopener noreferrer">Eunice Scott</a><br/>Born: Oct 12, 1925<br/>Died: Sep 28, 2009</td>
              <td>Janie, Jimmy, Alvin, Randy, Joyce, Cathy, Donna, Gary</td>
            </tr>
            <tr>
              <td><strong>Wallace Scott</strong><br/>Born: May 10, 1913<br/>Died: Nov 1, 1970</td>
              <td>Ella Scott</td>
              <td>Mary, Ann</td>
            </tr>
          </tbody>
        </table>
      </FamilyTable>
    </AncestryLayout>
  );
}
