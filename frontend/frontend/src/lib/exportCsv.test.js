import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportClaimsCsv } from './exportCsv';

describe('exportClaimsCsv', () => {
  let clickSpy;
  let anchorEl;
  let blobParts;

  beforeEach(() => {
    clickSpy = vi.fn();
    blobParts = null;
    anchorEl = { href: '', download: '', click: clickSpy };

    vi.spyOn(document, 'createElement').mockReturnValue(anchorEl);
    vi.spyOn(document.body, 'appendChild').mockReturnValue(undefined);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(undefined);

    // Capture raw CSV string passed to Blob constructor
    const OriginalBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation((parts, options) => {
      blobParts = parts;
      return new OriginalBlob(parts, options);
    });

    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getCsv = () => blobParts[0];

  it('creates a download link and clicks it', () => {
    exportClaimsCsv([]);
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('uses default filename', () => {
    exportClaimsCsv([]);
    expect(anchorEl.download).toBe('eden-claims-export.csv');
  });

  it('uses custom filename', () => {
    exportClaimsCsv([], 'custom.csv');
    expect(anchorEl.download).toBe('custom.csv');
  });

  it('CSV starts with BOM and contains headers', () => {
    exportClaimsCsv([]);
    const csv = getCsv();
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('Claim Number');
    expect(csv).toContain('Status');
    expect(csv).toContain('Property Address');
    expect(csv).toContain('Estimated Value');
  });

  it('formats claim data into CSV rows', () => {
    exportClaimsCsv([
      {
        claim_number: 'CLM-001',
        client_name: 'John Doe',
        status: 'Open',
        priority: 'High',
        property_address: '123 Main St',
        date_of_loss: '2026-01-15T00:00:00Z',
        claim_type: 'Water Damage',
        policy_number: 'POL-123',
        estimated_value: 50000,
        updated_at: '2026-01-20T00:00:00Z',
      },
    ]);

    const csv = getCsv();
    expect(csv).toContain('CLM-001');
    expect(csv).toContain('John Doe');
    expect(csv).toContain('Open');
    expect(csv).toContain('50000.00');
  });

  it('escapes commas in cell values', () => {
    exportClaimsCsv([
      {
        claim_number: 'CLM-001',
        client_name: 'Doe, John',
        property_address: '123 Main St, Apt 4',
      },
    ]);

    const csv = getCsv();
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"123 Main St, Apt 4"');
  });

  it('handles null values gracefully', () => {
    expect(() =>
      exportClaimsCsv([{ claim_number: null, client_name: undefined, status: 'Open' }])
    ).not.toThrow();
  });

  it('revokes object URL after timeout', () => {
    vi.useFakeTimers();
    exportClaimsCsv([]);
    vi.advanceTimersByTime(5000);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
  });
});
