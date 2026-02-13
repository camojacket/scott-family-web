'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Divider,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ImageIcon from '@mui/icons-material/Image';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease';
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import FormatClearIcon from '@mui/icons-material/FormatClear';

type Props = {
  value: string;
  onChange: (html: string) => void;
};

// ─── Toolbar button helper ──────────────────────────────────

function TBtn({
  icon,
  tooltip,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={tooltip} arrow>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            borderRadius: '6px',
            color: active ? 'var(--color-primary-600)' : 'var(--text-secondary)',
            bgcolor: active ? 'var(--color-primary-50, rgba(59,130,246,0.08))' : 'transparent',
            '&:hover': {
              bgcolor: active
                ? 'var(--color-primary-100, rgba(59,130,246,0.15))'
                : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

// ─── Toolbar ────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Exclude<ReturnType<typeof useEditor>, null> }) {
  const addLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt('Image URL');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  // Current heading level (0 = paragraph)
  const currentLevel = (() => {
    if (editor.isActive('heading', { level: 1 })) return 1;
    if (editor.isActive('heading', { level: 2 })) return 2;
    if (editor.isActive('heading', { level: 3 })) return 3;
    if (editor.isActive('heading', { level: 4 })) return 4;
    return 0;
  })();

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.25,
        px: 1,
        py: 0.5,
        borderBottom: '1px solid var(--border-color, #e0e0e0)',
        bgcolor: 'var(--card-bg, #fafafa)',
        borderRadius: '8px 8px 0 0',
      }}
    >
      {/* Block type selector */}
      <Select
        size="small"
        value={currentLevel}
        onChange={(e) => {
          const val = e.target.value as number;
          if (val === 0) {
            editor.chain().focus().setParagraph().run();
          } else {
            editor.chain().focus().toggleHeading({ level: val as 1 | 2 | 3 | 4 }).run();
          }
        }}
        sx={{
          minWidth: 120,
          height: 32,
          fontSize: 13,
          mr: 0.5,
          '& .MuiSelect-select': { py: 0.5 },
        }}
      >
        <MenuItem value={0}>Paragraph</MenuItem>
        <MenuItem value={1}>Heading 1</MenuItem>
        <MenuItem value={2}>Heading 2</MenuItem>
        <MenuItem value={3}>Heading 3</MenuItem>
        <MenuItem value={4}>Heading 4</MenuItem>
      </Select>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Inline formatting */}
      <TBtn
        icon={<FormatBoldIcon fontSize="small" />}
        tooltip="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <TBtn
        icon={<FormatItalicIcon fontSize="small" />}
        tooltip="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <TBtn
        icon={<FormatUnderlinedIcon fontSize="small" />}
        tooltip="Underline (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <TBtn
        icon={<StrikethroughSIcon fontSize="small" />}
        tooltip="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <TBtn
        icon={<CodeIcon fontSize="small" />}
        tooltip="Inline Code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <TBtn
        icon={<FormatClearIcon fontSize="small" />}
        tooltip="Clear Formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Alignment */}
      <TBtn
        icon={<FormatAlignLeftIcon fontSize="small" />}
        tooltip="Align Left"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      />
      <TBtn
        icon={<FormatAlignCenterIcon fontSize="small" />}
        tooltip="Align Center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      />
      <TBtn
        icon={<FormatAlignRightIcon fontSize="small" />}
        tooltip="Align Right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      />
      <TBtn
        icon={<FormatAlignJustifyIcon fontSize="small" />}
        tooltip="Justify"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Lists */}
      <TBtn
        icon={<FormatListBulletedIcon fontSize="small" />}
        tooltip="Bullet List"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <TBtn
        icon={<FormatListNumberedIcon fontSize="small" />}
        tooltip="Ordered List"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <TBtn
        icon={<FormatIndentDecreaseIcon fontSize="small" />}
        tooltip="Outdent (Shift+Tab)"
        onClick={() => editor.chain().focus().liftListItem('listItem').run()}
        disabled={!editor.can().liftListItem('listItem')}
      />
      <TBtn
        icon={<FormatIndentIncreaseIcon fontSize="small" />}
        tooltip="Indent (Tab)"
        onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
        disabled={!editor.can().sinkListItem('listItem')}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Blocks */}
      <TBtn
        icon={<FormatQuoteIcon fontSize="small" />}
        tooltip="Blockquote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <TBtn
        icon={<HorizontalRuleIcon fontSize="small" />}
        tooltip="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Link & Image */}
      <TBtn
        icon={<InsertLinkIcon fontSize="small" />}
        tooltip="Insert Link"
        active={editor.isActive('link')}
        onClick={addLink}
      />
      {editor.isActive('link') && (
        <TBtn
          icon={<LinkOffIcon fontSize="small" />}
          tooltip="Remove Link"
          onClick={() => editor.chain().focus().unsetLink().run()}
        />
      )}
      <TBtn
        icon={<ImageIcon fontSize="small" />}
        tooltip="Insert Image URL"
        onClick={addImage}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Undo / Redo */}
      <TBtn
        icon={<UndoIcon fontSize="small" />}
        tooltip="Undo (Ctrl+Z)"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      />
      <TBtn
        icon={<RedoIcon fontSize="small" />}
        tooltip="Redo (Ctrl+Y)"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      />
    </Box>
  );
}

// ─── Editor component ───────────────────────────────────────

export default function TiptapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your blog post…',
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
  });

  // Sync external value changes (e.g. reset after submit)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Box
      sx={{
        border: '1px solid var(--border-color, #e0e0e0)',
        borderRadius: '8px',
        overflow: 'hidden',
        '&:focus-within': {
          borderColor: 'var(--color-primary-500)',
          boxShadow: '0 0 0 2px var(--color-primary-100, rgba(59,130,246,0.15))',
        },

        /* ── Tiptap content styles ──────────────────────── */
        '& .tiptap-content': {
          minHeight: 300,
          maxHeight: 500,
          overflowY: 'auto',
          px: 2.5,
          py: 2,
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--foreground)',

          '& p': { m: 0, mb: 0.75 },
          '& h1': { fontSize: 28, fontWeight: 800, mt: 2, mb: 1 },
          '& h2': { fontSize: 22, fontWeight: 700, mt: 1.5, mb: 0.75 },
          '& h3': { fontSize: 18, fontWeight: 700, mt: 1.25, mb: 0.5 },
          '& h4': { fontSize: 16, fontWeight: 600, mt: 1, mb: 0.5 },
          '& ul, & ol': { pl: 3, mb: 1 },
          '& li': { mb: 0.25 },
          '& blockquote': {
            borderLeft: '3px solid var(--color-primary-300, #93c5fd)',
            pl: 2,
            ml: 0,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          },
          '& code': {
            bgcolor: 'rgba(0,0,0,0.05)',
            px: 0.5,
            py: 0.25,
            borderRadius: '4px',
            fontSize: '0.9em',
            fontFamily: 'monospace',
          },
          '& pre': {
            bgcolor: 'rgba(0,0,0,0.05)',
            p: 2,
            borderRadius: '6px',
            overflowX: 'auto',
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& hr': {
            border: 'none',
            borderTop: '1px solid var(--border-color, #e0e0e0)',
            my: 2,
          },
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '6px',
          },
          '& a': {
            color: 'var(--color-primary-600)',
            textDecoration: 'underline',
          },

          /* Placeholder */
          '& p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            float: 'left',
            color: 'var(--text-secondary)',
            opacity: 0.5,
            pointerEvents: 'none',
            height: 0,
          },
        },
      }}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </Box>
  );
}
