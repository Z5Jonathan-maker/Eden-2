/**
 * Tests for email HTML sanitizer (XSS prevention)
 */
import { sanitizeEmailHtml } from '../../lib/sanitize';

describe('sanitizeEmailHtml', () => {
  test('returns empty string for null/undefined input', () => {
    expect(sanitizeEmailHtml(null)).toBe('');
    expect(sanitizeEmailHtml(undefined)).toBe('');
    expect(sanitizeEmailHtml('')).toBe('');
  });

  test('allows safe HTML tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  test('allows images with src', () => {
    const html = '<img src="https://example.com/photo.jpg" alt="test" />';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('img');
    expect(result).toContain('src=');
  });

  test('allows links', () => {
    const html = '<a href="https://example.com">Click</a>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<a');
    expect(result).toContain('href=');
  });

  test('allows tables (email layout)', () => {
    const html = '<table><tr><td>Cell</td></tr></table>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<td>');
  });

  // XSS Prevention
  test('strips <script> tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
  });

  test('strips <iframe> tags', () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<iframe');
  });

  test('strips <form> tags', () => {
    const html = '<form action="https://evil.com"><input type="text" /></form>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  test('strips onclick handlers', () => {
    const html = '<div onclick="alert(1)">Click me</div>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click me');
  });

  test('strips onerror handlers on images', () => {
    const html = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('onerror');
  });

  test('strips javascript: URLs', () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('javascript:');
  });

  test('strips <embed> and <object> tags', () => {
    const html = '<embed src="evil.swf" /><object data="evil.swf"></object>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('<object');
  });

  test('strips <meta> and <link> tags', () => {
    const html = '<meta http-equiv="refresh" content="0;url=evil.com"><link rel="stylesheet" href="evil.css">';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<meta');
    expect(result).not.toContain('<link');
  });

  test('handles complex real-world email HTML', () => {
    const html = `
      <div style="font-family: Arial;">
        <h2>Insurance Claim Update</h2>
        <p>Dear <strong>Jonathan</strong>,</p>
        <table border="1">
          <tr><td>Claim #</td><td>CLM-2024-001</td></tr>
          <tr><td>Status</td><td>Approved</td></tr>
        </table>
        <a href="https://portal.example.com/claim/123">View Claim</a>
        <img src="https://example.com/logo.png" alt="Logo" />
      </div>
    `;
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('Insurance Claim Update');
    expect(result).toContain('<table');
    expect(result).toContain('<a');
    expect(result).toContain('<img');
    expect(result).not.toContain('<script');
  });
});
