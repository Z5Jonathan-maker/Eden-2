import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from './sanitize';

describe('sanitizeEmailHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeEmailHtml('')).toBe('');
    expect(sanitizeEmailHtml(null)).toBe('');
    expect(sanitizeEmailHtml(undefined)).toBe('');
  });

  it('preserves safe HTML tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
  });

  it('preserves links with href', () => {
    const html = '<a href="https://example.com">Link</a>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('href="https://example.com"');
  });

  it('preserves images', () => {
    const html = '<img src="https://example.com/img.png" alt="test" />';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('src="https://example.com/img.png"');
  });

  it('preserves tables', () => {
    const html = '<table><tr><td>Cell</td></tr></table>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<table>');
    expect(result).toContain('<td>');
  });

  it('strips script tags', () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe');
  });

  it('strips iframe tags', () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<iframe');
  });

  it('strips form elements', () => {
    const html = '<form action="/steal"><input type="text"><button>Submit</button></form>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
  });

  it('strips event handler attributes', () => {
    const html = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('onerror');
  });

  it('strips onclick attributes', () => {
    const html = '<div onclick="alert(1)">Click me</div>';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('onclick');
  });

  it('strips object and embed tags', () => {
    const html = '<object data="x"></object><embed src="x">';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('strips meta and link tags', () => {
    const html = '<meta http-equiv="refresh" content="0;url=evil"><link rel="stylesheet" href="evil.css">';
    const result = sanitizeEmailHtml(html);
    expect(result).not.toContain('<meta');
    expect(result).not.toContain('<link');
  });

  it('preserves allowed style attributes', () => {
    const html = '<div style="color: red;">Styled</div>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('style');
  });

  it('preserves list elements', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('preserves heading elements', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
  });
});
