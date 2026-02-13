// ─── Page Content (Modular block-based CMS) ────────────────

/** Union type for all content block variants. */
export type ContentBlock =
  | HeroBlock
  | TextBlock
  | ImageBlock
  | ImageRowBlock
  | DividerBlock
  | ListBlock;

export interface HeroBlock {
  type: 'hero';
  src: string;
  alt: string;
  title: string;
}

export interface TextBlock {
  type: 'text';
  html: string;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  /** How the image sits in the layout */
  alignment: 'left' | 'center' | 'right' | 'full';
  /** Optional explicit height in px (width is responsive) */
  height?: number;
}

export interface ImageRowBlock {
  type: 'image-row';
  /** Two or more images displayed side by side */
  images: ImageBlock[];
  /** Gap between images in px */
  gap?: number;
}

export interface DividerBlock {
  type: 'divider';
}

export interface ListBlock {
  type: 'list';
  style: 'bullet' | 'numbered';
  items: string[];
}

/** The shape returned by GET /api/page-content/:key */
export interface PageContentResponse {
  pageKey: string;
  /** JSON-encoded array when coming from the API, or already parsed */
  blocks: string | ContentBlock[];
}
