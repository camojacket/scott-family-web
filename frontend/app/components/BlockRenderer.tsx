'use client';

import Image from './CdnImage';
import { Typography, Box, Divider } from '@mui/material';
import { sanitizeHtml } from '../lib/sanitize';
import type { ContentBlock } from '../lib/pageContentTypes';

/**
 * Renders a single content block. Pure display — no editing.
 */
export function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'hero':
      return <HeroRenderer block={block} />;
    case 'text':
      return <TextRenderer block={block} />;
    case 'image':
      return <ImageRenderer block={block} />;
    case 'image-row':
      return <ImageRowRenderer block={block} />;
    case 'divider':
      return <Divider sx={{ my: 4 }} />;
    case 'list':
      return <ListRenderer block={block} />;
    default:
      return null;
  }
}

/**
 * Renders an array of content blocks.
 */
export default function BlockRendererList({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </>
  );
}

// ─── Individual block renderers ─────────────────────────────

function HeroRenderer({ block }: { block: Extract<ContentBlock, { type: 'hero' }> }) {
  return (
    <Box className="card" sx={{ overflow: 'hidden', mb: 4 }}>
      <Box sx={{ position: 'relative', height: { xs: 220, sm: 320 } }}>
        <Image
          src={block.src}
          alt={block.alt}
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)',
          }}
        />
        <Typography
          variant="h4"
          sx={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            color: '#fff',
            fontWeight: 800,
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {block.title}
        </Typography>
      </Box>
    </Box>
  );
}

function TextRenderer({ block }: { block: Extract<ContentBlock, { type: 'text' }> }) {
  return (
    <Box
      sx={{
        color: 'var(--text-secondary)',
        lineHeight: 1.8,
        mb: 3,
        '& p': { mb: 1.5 },
        '& h1, & h2, & h3, & h4': { color: 'var(--foreground)', mt: 2, mb: 1 },
        '& ul, & ol': { pl: 3, mb: 1.5 },
        '& li': { mb: 0.5 },
        '& blockquote': {
          borderLeft: '4px solid var(--color-primary-300)',
          pl: 2,
          ml: 0,
          fontStyle: 'italic',
          color: 'var(--text-secondary)',
        },
        '& a': { color: 'var(--color-primary-600)', textDecoration: 'underline' },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: '8px' },
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html) }}
    />
  );
}

function ImageRenderer({ block }: { block: Extract<ContentBlock, { type: 'image' }> }) {
  const alignment = block.alignment || 'center';
  const height = block.height || 300;

  // Float-based layout for left/right alignment so text wraps around
  const isFloated = alignment === 'left' || alignment === 'right';

  return (
    <Box
      sx={{
        my: isFloated ? 1 : 4,
        mx: isFloated ? (alignment === 'left' ? { xs: 0, sm: '0 16px 16px 0' } : { xs: 0, sm: '0 0 16px 16px' }) : 0,
        float: isFloated ? { xs: 'none', sm: alignment } : 'none',
        width: isFloated ? { xs: '100%', sm: '45%' } : '100%',
        maxWidth: '100%',
        textAlign: !isFloated ? alignment as 'left' | 'center' | 'right' : undefined,
        ...(isFloated && alignment === 'left' && { mr: { xs: 0, sm: 3 }, mb: { xs: 2, sm: 2 } }),
        ...(isFloated && alignment === 'right' && { ml: { xs: 0, sm: 3 }, mb: { xs: 2, sm: 2 } }),
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: { xs: Math.min(height, 200), sm: height },
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <Image
          src={block.src}
          alt={block.alt}
          fill
          style={{ objectFit: 'cover' }}
        />
      </Box>
      {block.caption && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {block.caption}
        </Typography>
      )}
    </Box>
  );
}

function ListRenderer({ block }: { block: Extract<ContentBlock, { type: 'list' }> }) {
  return (
    <Box
      sx={{
        bgcolor: 'var(--color-primary-50)',
        borderRadius: 'var(--radius-lg)',
        p: { xs: 2, sm: 3 },
        borderLeft: '4px solid var(--color-primary-300)',
        mb: 3,
      }}
    >
      {block.items.map((item, i) => (
        <Typography
          key={i}
          sx={{
            color: 'var(--text-secondary)',
            py: 0.75,
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          {block.style === 'numbered' ? `${i + 1}.` : '\u2022'}&nbsp; {item}
        </Typography>
      ))}
    </Box>
  );
}

function ImageRowRenderer({ block }: { block: Extract<ContentBlock, { type: 'image-row' }> }) {
  const gap = block.gap ?? 16;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: `${gap}px`,
        my: 4,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}
    >
      {block.images.map((img, i) => {
        const height = img.height || 300;
        return (
          <Box key={i} sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Box
              sx={{
                position: 'relative',
                height: { xs: Math.min(height, 200), sm: height },
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                width: '100%',
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                style={{ objectFit: 'cover' }}
              />
            </Box>
            {img.caption && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 1,
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  textAlign: 'center',
                }}
              >
                {img.caption}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
