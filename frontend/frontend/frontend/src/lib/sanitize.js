/**
 * HTML Sanitization utilities for Eden
 * Uses DOMPurify to prevent XSS from untrusted HTML (emails, user content).
 */
import DOMPurify from 'dompurify';

const EMAIL_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col',
    'colgroup', 'dd', 'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'mark', 'ol', 'p',
    'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'style', 'class', 'width', 'height',
    'align', 'valign', 'bgcolor', 'border', 'cellpadding', 'cellspacing',
    'colspan', 'rowspan', 'target', 'dir', 'lang',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: [
    'script', 'iframe', 'object', 'embed', 'form', 'input',
    'textarea', 'select', 'button', 'meta', 'link', 'base',
  ],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

/**
 * Sanitize HTML from email bodies.
 * Allows formatting tags, images, tables — blocks scripts, iframes, forms, event handlers.
 */
export function sanitizeEmailHtml(dirtyHtml) {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, EMAIL_CONFIG);
}
