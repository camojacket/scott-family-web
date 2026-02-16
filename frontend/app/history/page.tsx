import type { Metadata } from 'next';
import { serverFetch, getFamilyLabel } from '../lib/serverFetch';
import EditablePageContent from '../components/EditablePageContent';
import type { ContentBlock, PageContentResponse } from '../lib/pageContentTypes';

export async function generateMetadata(): Promise<Metadata> {
  const { family } = await getFamilyLabel();
  return {
    title: `${family} History — Our Legacy`,
    description: `The heritage and history of the ${family}, descendants of Sarah Scott and Marcus A. Scott.`,
  };
}

const PAGE_KEY = 'history';

/**
 * Default blocks — shown when the DB has no record yet so the page isn't blank.
 * Once an admin saves, the API version takes over.
 */
const DEFAULT_BLOCKS: ContentBlock[] = [
  {
    type: 'hero',
    src: '/images/sarahscott1 (1).jpg',
    alt: 'Sarah Scott',
    title: 'Our Legacy: Sarah Scott & Descendants',
  },
  {
    type: 'text',
    html: '<p>The United States of America introduced slavery in 1619.  Among those Africans who were born into slavery was Sarah Scott.  Sarah was very courageous in the days of her bondage.  Sarah fought against the idea of having to bare children for the master.  Sarah knew she had no rights, yet she felt she was treated unjustly as a human being.  Inwardly she knew that she had moral values.  As a slave, her feelings were of no concern to the master.  Sarah was considered a valuable piece of property.</p>',
  },
  {
    type: 'text',
    html: '<p>The master wanted Sarah to bare his children.  Due to her rejection towards him, Sarah was beaten many times.  After a number of beatings, she began bearing children.  Sarah gave birth to three girls and two boys.  The master being the father of the children, named the children after his relatives.  The children were Victoria, Hannah, Mamie, Marcus, and Jim. Click here to view Freedman\u2019s Bank Record for Sarah Scott.</p>',
  },
  { type: 'divider' },
  {
    type: 'text',
    html: '<p>Marcus, one of Sarah\u2019s sons, married Caroline Wright of Tarboro, South Carolina.  Caroline\u2019s mother was Deaiah Wright.  Her sisters and brothers were Liza, Rose, Henry, Sam, Elliot and Franklin.  Marcus and Caroline had nine children.  They were Mamie, Ellen, Marcus Jr., Sandy, Eugene, Jim, Jeff, Joe, and Willie.  There was also a stepdaughter named Juna.  Marcus and Caroline resided in Tarboro, South Carolina for many years.  In 1895, Marcus moved his family to Burke County.  He and his family remained in Burke County until 1907.</p>',
  },
  {
    type: 'text',
    html: '<p>In 1908, Marcus and his family moved to Liberty County.  There he became the owner of a Turpentine and Timber Farm.  Marcus and Caroline Scott\u2019s children grew up in Ludowici, Georgia in an area known as \u201cBroad Level.\u201d Click here to view Census Records for Marcus Scott\u2019s family from 1880 \u2013 1930.</p>',
  },
  {
    type: 'text',
    html: '<p><strong>The Scott children grew up and married the following persons:</strong></p>',
  },
  {
    type: 'list',
    style: 'bullet',
    items: [
      'Mamie Scott married Willie Flynn of Reidsville, Georgia.',
      'Ellen Scott united with John Henry Phillips of Raleigh, North Carolina.  In this union were born:  John Henry Phillips Jr., Lula, Ida, Berdie, Eva, Marcus, Carrie, Mamie, Eddie Mae, and William.  Ellen Scott Phillips also reared Waddie, Flossie, Maybell and Charlie Mitchell.',
      'Marcus Scott Jr. (Big Bubba) beheld Maggie Williams.  From the union were born Alan, Victoria, Grace, Obidiah, Marcus III, Lewis, and James.  After Maggie\u2019s death, Marcus married Lena Roundtree of Savannah, Georgia.  To this marriage is one daughter, Louise.',
      'John Henry, known as Sandy Betrol, beheld Janie Parker of Ludowici, Georgia.  Janie gave birth to Wallace, Albert, Matthew, Mamie, Nellie Mae, Eva Dell, and Nevel.',
      'Eugene Scott took marital vows with Anna Harris of Ludowici, Georgia.  Anna and Eugene had one daughter, Betty Jean.',
      'Jeff married Mary Mitchell of Savannah, Georgia.  There were two children, James and Mary Ann.',
      'Joe Scott betrothed Francis Slater from Ludowici, Georgia.  From this reunion was born one son, Norman.',
      'Willie, also known as Bill, married Mae Hill.  Willie and Mae have one daughter.  After Mae\u2019s death, Willie united with Hattie of Savannah, Georgia.',
      'Jim?',
    ],
  },
  {
    type: 'text',
    html: '<p>Mamie, Ellen, Jeff and Eugene made their homes in Savannah, Georgia.  Willie resided in Vero Beach, Florida.  Due to the separation of the Scott children, there was an urge to strengthen the family.  This longing developed into visitation and a family feast at least once a year.  This feast took place in the lifetime of Marcus and Caroline Scott, and Mamie Flynn.</p>',
  },
  {
    type: 'text',
    html: '<p>One feast was held in the home of Willie and Mamie Flynn in 1926.  At this event, a great number of relatives were present.  On this occasion, a family photo was taken.  This tradition continued with a few family members.  Marcus and Lena Scott, Nellie Mae Miles, Ellen Phillips, Eva Poole, and John Phillips II would commute from Savannah to Ludowici and vice versa for family gatherings.  From these gatherings, a suggestion was made at the home of Marcus and Lena Scott to have an Annual Family Reunion.</p>',
  },
  {
    type: 'image',
    src: '/images/sarahscott1 (1).jpg',
    alt: 'Scott Family Gathering',
    caption: 'An early Scott family gathering',
    alignment: 'center',
    height: 300,
  },
  { type: 'divider' },
  {
    type: 'text',
    html: '<p>Family members were notified verbally and by letter to attend a reunion at the home of Marcus and Lena Scott.  The number of relatives attending established a Gala Event in the Scott Family for years to come.  From that day forward, a reunion for the {family} Family is held annually on the third Sunday in July.</p>',
  },
  {
    type: 'text',
    html: '<p>At the first organized reunion of the {family} Family, Marcus was elected president and held the position for a number of years.  Attending the first organized reunion were the families of Alan Scott, Ida Gibbs, Lula and Lacy Langster, Eugene and Anna Scott, Dan Berksteiner, Wallace Scott, Joe Scott, Joe Williams, and Marcus Scott.</p>',
  },
  {
    type: 'text',
    html: '<p>The reunion grew in numbers and in love.  For this reason, we give God the glory and reverence for allowing us the opportunity to meet annually for many years and for safe travel.  Special recognition and presentations were given to the oldest children of Caroline and Marcus Scott, and to the oldest children of Mamie, Ellen, Marcus Jr., Sandy, Eugene, Jim, Jeff, Joe, Willie, and Juna.  This is done during Sunday service.  We hope this trend will continue with each oldest child for generations to come.</p>',
  },
  {
    type: 'text',
    html: '<p>Uncle Eugene, the last of living child of Marcus and Caroline Scott, died at the age of 91.  Uncle Eugene and Aunt Tiny (Anna) were blessed to be married for 65 years.  Aunt Tiny, our oldest living aunt, departed this life on Friday, August 21, 1998.  She lived to be 95 years old.</p>',
  },
  {
    type: 'text',
    html: '<p>We give recognition to Eugene and Anna Scott and Eva Poole for information that makes this history.  In 2008, Eva Poole is the oldest family member, at age 100.  Thanks are given to Jacquelyn Maxwell and Gwendolyn Walker for the first recorded history of the {family} Family Reunion, written in 1984.</p>',
  },
];

export default async function HistoryPage() {
  let blocks = DEFAULT_BLOCKS;

  try {
    const res = await serverFetch<PageContentResponse>(`/api/page-content/${PAGE_KEY}`);
    let parsed: ContentBlock[];
    if (typeof res.blocks === 'string') {
      try {
        parsed = JSON.parse(res.blocks);
      } catch {
        parsed = [];
      }
    } else {
      parsed = res.blocks;
    }
    if (parsed.length > 0) {
      blocks = parsed;
    }
  } catch {
    // Keep defaults — page isn't blank
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', paddingTop: 24, paddingBottom: 40 }}>
      <EditablePageContent pageKey={PAGE_KEY} initialBlocks={blocks} />
    </div>
  );
}
