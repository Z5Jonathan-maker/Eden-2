import React, { useState, useRef, useCallback } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REPORT_CONTAINER_ID = 'eden-claim-report-print';

const printStyles = `
@media print {
  body * {
    visibility: hidden !important;
  }
  #${REPORT_CONTAINER_ID},
  #${REPORT_CONTAINER_ID} * {
    visibility: visible !important;
  }
  #${REPORT_CONTAINER_ID} {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    padding: 40px;
    background: #fff !important;
    color: #000 !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
  }
  .report-header {
    border-bottom: 2px solid #f97316;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .report-header h1 {
    font-size: 20pt;
    color: #1a1a1a !important;
    margin: 0 0 4px 0;
  }
  .report-header p {
    font-size: 10pt;
    color: #666 !important;
    margin: 0;
  }
  .report-section {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .report-section h2 {
    font-size: 13pt;
    color: #f97316 !important;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 6px;
    margin: 0 0 12px 0;
  }
  .report-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
  }
  .report-field {
    margin-bottom: 8px;
  }
  .report-field .label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888 !important;
    margin: 0;
  }
  .report-field .value {
    font-size: 11pt;
    color: #1a1a1a !important;
    margin: 2px 0 0 0;
    font-weight: 500;
  }
  .report-notes {
    white-space: pre-wrap;
    font-size: 10pt;
    color: #333 !important;
    background: #f9f9f9 !important;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #e5e5e5;
  }
  .report-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e5e5;
    font-size: 8pt;
    color: #aaa !important;
    text-align: center;
  }
}
`;

const formatCurrency = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 'N/A';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const buildNotesText = (claim) => {
  if (Array.isArray(claim.notes) && claim.notes.length > 0) {
    return claim.notes
      .map((n) => (typeof n === 'string' ? n : n.content || n.text || JSON.stringify(n)))
      .join('\n\n');
  }
  if (typeof claim.notes === 'string' && claim.notes.trim()) {
    return claim.notes;
  }
  return null;
};

const ClaimReportButton = ({ claim }) => {
  const [generating, setGenerating] = useState(false);
  const styleRef = useRef(null);
  const containerRef = useRef(null);

  const handleGenerate = useCallback(() => {
    if (!claim) return;

    setGenerating(true);

    // Inject print stylesheet
    if (!styleRef.current) {
      const style = document.createElement('style');
      style.id = 'eden-report-print-styles';
      style.textContent = printStyles;
      document.head.appendChild(style);
      styleRef.current = style;
    }

    // Build hidden report container
    let container = document.getElementById(REPORT_CONTAINER_ID);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = REPORT_CONTAINER_ID;
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;';

    const notesText = buildNotesText(claim);
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    container.innerHTML = `
      <div class="report-header">
        <h1>Care Claims &mdash; Claim Report</h1>
        <p>Claim #${claim.claim_number || 'N/A'} &bull; Generated ${reportDate}</p>
      </div>

      <div class="report-section">
        <h2>Client Information</h2>
        <div class="report-grid">
          <div class="report-field">
            <p class="label">Client Name</p>
            <p class="value">${claim.client_name || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Phone</p>
            <p class="value">${claim.client_phone || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Email</p>
            <p class="value">${claim.client_email || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Property Address</p>
            <p class="value">${claim.property_address || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div class="report-section">
        <h2>Claim Details</h2>
        <div class="report-grid">
          <div class="report-field">
            <p class="label">Claim Number</p>
            <p class="value">${claim.claim_number || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Date of Loss</p>
            <p class="value">${formatDate(claim.date_of_loss)}</p>
          </div>
          <div class="report-field">
            <p class="label">Claim Type</p>
            <p class="value">${claim.claim_type || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Insurance Carrier</p>
            <p class="value">${claim.insurance_carrier || claim.carrier || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Policy Number</p>
            <p class="value">${claim.policy_number || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Status</p>
            <p class="value">${claim.status || 'N/A'}</p>
          </div>
          <div class="report-field">
            <p class="label">Estimated Value</p>
            <p class="value">${formatCurrency(claim.estimated_value)}</p>
          </div>
          <div class="report-field">
            <p class="label">Assigned To</p>
            <p class="value">${claim.assigned_to || 'Unassigned'}</p>
          </div>
        </div>
      </div>

      ${
        notesText
          ? `
      <div class="report-section">
        <h2>Notes Summary</h2>
        <div class="report-notes">${notesText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>`
          : ''
      }

      <div class="report-footer">
        Generated by Eden-2 Command Center &bull; Care Claims &bull; ${reportDate}
      </div>
    `;

    document.body.appendChild(container);
    containerRef.current = container;

    // Trigger print dialog
    requestAnimationFrame(() => {
      window.print();
      setGenerating(false);
      toast.success('Report generated');

      // Clean up after a brief delay to allow print dialog to complete
      setTimeout(() => {
        const el = document.getElementById(REPORT_CONTAINER_ID);
        if (el) el.remove();
      }, 1000);
    });
  }, [claim]);

  return (
    <button
      onClick={handleGenerate}
      disabled={generating || !claim}
      className="min-h-[44px] px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="generate-report-btn"
    >
      {generating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      Generate Report
    </button>
  );
};

export default ClaimReportButton;
