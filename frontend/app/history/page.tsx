'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockRendererList from '../components/BlockRenderer';
import { apiFetch } from '../lib/api';
import { useFamilyName } from '../lib/FamilyNameContext';
import type { ContentBlock, PageContentResponse } from '../lib/pageContentTypes';
import type { ProfileDto } from '../lib/types';

const BlockEditor = dynamic(() => import('../components/BlockEditor'), { ssr: false });

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

export default function HistoryPage() {
  const { full } = useFamilyName();

  // ── Auth state ──
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Content state ──
  const [blocks, setBlocks] = useState<ContentBlock[]>(DEFAULT_BLOCKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Edit mode state ──
  const [editing, setEditing] = useState(false);
  const [editBlocks, setEditBlocks] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load admin status ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem('profile');
      if (raw) {
        const p: ProfileDto = JSON.parse(raw);
        const role = p.userRole;
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Load page content from API ──
  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<PageContentResponse>(`/api/page-content/${PAGE_KEY}`);
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
      // If empty (no record in DB yet), keep defaults
      if (parsed.length > 0) {
        setBlocks(parsed);
      }
    } catch {
      // On error, just keep defaults — page still renders
      console.warn('Could not load page content, using defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // ── Enter edit mode ──
  const startEditing = () => {
    setEditBlocks(JSON.parse(JSON.stringify(blocks))); // deep clone
    setSaveError(null);
    setEditing(true);
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch(`/api/page-content/${PAGE_KEY}`, {
        method: 'PUT',
        body: { blocks: JSON.stringify(editBlocks) },
      });
      setBlocks(editBlocks);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel edit ──
  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  // ── Resolve {family} placeholders in blocks for display ──
  const resolvePlaceholders = (raw: ContentBlock[]): ContentBlock[] =>
    JSON.parse(JSON.stringify(raw).replaceAll('{family}', full));

  // ── Resolve {family} placeholders for display ──
  const resolved = resolvePlaceholders(blocks);

  // ── Loading state ──
  if (loading) {
    return (
      <Box sx={{ maxWidth: 780, mx: 'auto', py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto', py: { xs: 3, sm: 5 } }}>
      {/* Admin edit button */}
      {isAdmin && !editing && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={startEditing}
            sx={{ textTransform: 'none' }}
          >
            Edit Page
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Edit mode */}
      {editing ? (
        <BlockEditor
          blocks={editBlocks}
          onChange={setEditBlocks}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
          error={saveError}
        />
      ) : (
        /* View mode — render blocks inside styled cards */
        <>
          {/* Render hero block outside card (if first block is hero) */}
          {resolved.length > 0 && resolved[0].type === 'hero' && (
            <BlockRendererList blocks={[resolved[0]]} />
          )}

          <Box className="card" sx={{ p: { xs: 3, sm: 5 }, overflow: 'hidden' }}>
            <BlockRendererList
              blocks={resolved[0]?.type === 'hero' ? resolved.slice(1) : resolved}
            />
            {/* Clearfix for floated images */}
            <Box sx={{ clear: 'both' }} />
          </Box>
        </>
      )}
    </Box>
  );
}
