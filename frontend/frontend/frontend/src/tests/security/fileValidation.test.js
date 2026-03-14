/**
 * Tests for file upload validation (type + size limits)
 */

describe('File Upload Validation Logic', () => {
  const ALLOWED_FILE_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'text/plain', 'text/csv',
    'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav',
  ]);

  const MAX_CHAT_SIZE = 15 * 1024 * 1024;
  const MAX_DOC_SIZE = 50 * 1024 * 1024;

  const validateChatFile = (file) => {
    if (file.size > MAX_CHAT_SIZE) return { valid: false, reason: 'size' };
    if (file.type && !ALLOWED_FILE_TYPES.has(file.type)) return { valid: false, reason: 'type' };
    return { valid: true };
  };

  const validateDocFile = (file) => {
    if (file.size > MAX_DOC_SIZE) return { valid: false, reason: 'size' };
    return { valid: true };
  };

  // Chat uploads
  test('accepts JPEG images', () => {
    expect(validateChatFile({ size: 1024, type: 'image/jpeg' }).valid).toBe(true);
  });

  test('accepts PNG images', () => {
    expect(validateChatFile({ size: 1024, type: 'image/png' }).valid).toBe(true);
  });

  test('accepts PDFs', () => {
    expect(validateChatFile({ size: 1024, type: 'application/pdf' }).valid).toBe(true);
  });

  test('accepts Word documents', () => {
    expect(validateChatFile({
      size: 1024,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }).valid).toBe(true);
  });

  test('accepts Excel spreadsheets', () => {
    expect(validateChatFile({
      size: 1024,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }).valid).toBe(true);
  });

  test('accepts CSV files', () => {
    expect(validateChatFile({ size: 1024, type: 'text/csv' }).valid).toBe(true);
  });

  test('accepts MP4 video', () => {
    expect(validateChatFile({ size: 1024, type: 'video/mp4' }).valid).toBe(true);
  });

  test('rejects executable files', () => {
    const result = validateChatFile({ size: 1024, type: 'application/x-msdownload' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('type');
  });

  test('rejects shell scripts', () => {
    const result = validateChatFile({ size: 1024, type: 'application/x-sh' });
    expect(result.valid).toBe(false);
  });

  test('rejects HTML files (potential XSS)', () => {
    const result = validateChatFile({ size: 1024, type: 'text/html' });
    expect(result.valid).toBe(false);
  });

  test('rejects files over 15MB for chat', () => {
    const result = validateChatFile({ size: 16 * 1024 * 1024, type: 'image/jpeg' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('size');
  });

  test('accepts files at exactly 15MB for chat', () => {
    expect(validateChatFile({ size: MAX_CHAT_SIZE, type: 'image/jpeg' }).valid).toBe(true);
  });

  // Document uploads
  test('rejects files over 50MB for documents', () => {
    const result = validateDocFile({ size: 51 * 1024 * 1024 });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('size');
  });

  test('accepts files under 50MB for documents', () => {
    expect(validateDocFile({ size: 10 * 1024 * 1024 }).valid).toBe(true);
  });
});
