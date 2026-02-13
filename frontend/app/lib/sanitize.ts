/**
 * Lightweight HTML sanitizer for user-generated rich text content.
 * Strips all tags/attributes except a safe allowlist.
 * For production, consider using DOMPurify for comprehensive protection.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr',
  'th', 'td', 'span', 'div', 'sub', 'sup', 'hr',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  '*': new Set(['class', 'style']),
};

/**
 * Sanitize HTML string by parsing it with the browser's DOMParser
 * and stripping disallowed elements/attributes.
 *
 * Runs client-side only (requires DOM APIs).
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // SSR: strip all tags as a safe fallback
    return dirty.replace(/<[^>]*>/g, '');
  }

  const doc = new DOMParser().parseFromString(dirty, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const toRemove: Node[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Remove the tag but keep its text content
        toRemove.push(child);
        return;
      }

      // Strip disallowed attributes
      const allowedForTag = ALLOWED_ATTRS[tag] ?? new Set<string>();
      const globalAllowed = ALLOWED_ATTRS['*'] ?? new Set<string>();
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (!allowedForTag.has(attr.name) && !globalAllowed.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }

      // Enforce safe links
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (href.startsWith('javascript:') || href.startsWith('data:')) {
          el.setAttribute('href', '#');
        }
        el.setAttribute('rel', 'noopener noreferrer');
      }

      // Recurse into children
      sanitizeNode(child);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      toRemove.push(child);
    }
  });

  for (const n of toRemove) {
    // Replace removed elements with their text content
    if (n.nodeType === Node.ELEMENT_NODE) {
      const text = document.createTextNode(n.textContent || '');
      node.replaceChild(text, n);
    } else {
      node.removeChild(n);
    }
  }
}
