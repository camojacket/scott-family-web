/**
 * HTML sanitizer for user-generated rich text content.
 * Uses DOMPurify (via isomorphic-dompurify) for comprehensive XSS protection
 * on both client and server.
 */

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr',
  'th', 'td', 'span', 'div', 'sub', 'sup', 'hr',
];

const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope',
  'class', 'style',
];

/**
 * Sanitize an HTML string, keeping only safe tags and attributes.
 * Works on both client (browser DOM) and server (jsdom via isomorphic-dompurify).
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
