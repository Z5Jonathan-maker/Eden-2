import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Download, ExternalLink, ChevronDown } from 'lucide-react';

const REPORT_TYPES = {
  dol_discovery: [
    { key: 'carrier_facing', label: 'Carrier-Facing DOL Report', desc: 'Defensible date-of-loss summary for carrier submission' },
    { key: 'client_update',  label: 'Client Update',             desc: 'Homeowner-friendly weather event summary' },
  ],
  property_imagery: [
    { key: 'carrier_facing', label: 'Carrier-Facing Imagery Report', desc: 'Before/after aerial evidence for carrier' },
    { key: 'client_update',  label: 'Client Property Report',        desc: 'Property condition summary for homeowner' },
  ],
  permits: [
    { key: 'carrier_facing', label: 'Carrier-Facing Permit Report', desc: 'Permit history + prior work analysis for carrier' },
    { key: 'client_update',  label: 'Client Permit Summary',        desc: 'Permit history overview for homeowner' },
  ],
};

const ReportGenerator = ({ context = 'dol_discovery', getData, address }) => {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const types = REPORT_TYPES[context] || REPORT_TYPES.dol_discovery;

  const generate = async (reportType) => {
    setGenerating(true);
    try {
      const data = typeof getData === 'function' ? getData() : {};
      if (!data || (Object.keys(data).length === 0)) {
        toast.error('No data to generate report. Run a search first.');
        return;
      }

      const html = buildHtmlReport(context, reportType.key, data, address);
      downloadHtml(html, `${context}_${reportType.key}_report.html`);
      toast.success('Report downloaded');
    } catch (err) {
      console.error('Report generation failed:', err);
      toast.error(err?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border-t border-zinc-800/50 bg-zinc-900/40 px-4 sm:px-6 py-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-mono uppercase text-zinc-400 hover:text-zinc-200 transition-colors w-full"
      >
        <FileText className="w-4 h-4" />
        Generate Report
        <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {types.map((rt) => (
            <button
              key={rt.key}
              onClick={() => generate(rt)}
              disabled={generating}
              className="text-left p-3 rounded-lg border border-zinc-800/60 bg-zinc-950/30 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all disabled:opacity-50 group"
            >
              <div className="flex items-center gap-2">
                {generating ? (
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                )}
                <span className="text-sm text-zinc-200 font-mono">{rt.label}</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1">{rt.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Download helper ──────────────────────────────────────────────────

function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── HTML report builders ─────────────────────────────────────────────

function buildHtmlReport(context, reportKey, data, address) {
  const carrier = reportKey === 'carrier_facing';
  const addr = address || data?.address || 'Property';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = carrier ? 'Carrier-Facing Report' : 'Client Summary Report';

  let body = '';

  if (context === 'dol_discovery') {
    body = buildDolBody(data, addr, carrier);
  } else if (context === 'property_imagery') {
    body = buildImageryBody(data, addr, carrier);
  } else if (context === 'permits') {
    body = buildPermitsBody(data, addr, carrier);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${addr}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #fff; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 24px; color: #ea580c; margin-bottom: 4px; }
  .header .subtitle { font-size: 14px; color: #666; }
  .header .meta { font-size: 12px; color: #999; margin-top: 8px; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 18px; color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 12px; }
  .section h3 { font-size: 15px; color: #555; margin-bottom: 8px; }
  .field { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
  .field .label { font-weight: 600; min-width: 160px; color: #555; font-size: 13px; }
  .field .value { color: #1a1a1a; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f8f8f8; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #555; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  tr:hover { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-orange { background: #ffedd5; color: #9a3412; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <div class="subtitle">${addr}</div>
  <div class="meta">Generated ${date} · Eden Intel Hub${carrier ? ' · For Carrier Submission' : ''}</div>
</div>
${body}
<div class="footer">Eden Claims Intelligence Platform · Confidential</div>
</body>
</html>`;
}

function buildDolBody(data, addr, carrier) {
  const candidates = data?.candidates || [];
  const location = data?.location || {};
  const top = candidates[0];

  let html = `<div class="section"><h2>Property Information</h2>
    <div class="field"><span class="label">Address</span><span class="value">${addr}</span></div>`;
  if (location.latitude) {
    html += `<div class="field"><span class="label">Coordinates</span><span class="value">${location.latitude}, ${location.longitude}</span></div>`;
  }
  html += `</div>`;

  if (top) {
    html += `<div class="section"><h2>Recommended Date of Loss</h2>
      <div class="field"><span class="label">Date</span><span class="value" style="font-size:16px;font-weight:700;color:#ea580c">${top.date || 'N/A'}</span></div>
      <div class="field"><span class="label">Confidence</span><span class="value"><span class="badge badge-green">${top.confidence || 'N/A'}</span></span></div>
      <div class="field"><span class="label">Explanation</span><span class="value">${top.explanation || ''}</span></div>
    </div>`;
  }

  if (candidates.length > 1) {
    html += `<div class="section"><h2>Alternate Candidate Dates</h2><table><thead><tr><th>Date</th><th>Confidence</th><th>Explanation</th></tr></thead><tbody>`;
    candidates.slice(1).forEach(c => {
      html += `<tr><td>${c.date || 'N/A'}</td><td><span class="badge badge-blue">${c.confidence || 'N/A'}</span></td><td>${c.explanation || ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if (carrier) {
    html += `<div class="section"><h2>Evidence Summary</h2><p style="font-size:13px;color:#555">Date-of-loss candidates sourced from NOAA weather stations, HAIL/wind databases, and ESRI historical imagery. All data points are carrier-defensible and independently verifiable.</p></div>`;
  }

  return html;
}

function buildImageryBody(data, addr, carrier) {
  const images = data?.images || [];
  let html = `<div class="section"><h2>Property Information</h2>
    <div class="field"><span class="label">Address</span><span class="value">${addr}</span></div>
    <div class="field"><span class="label">Imagery Source</span><span class="value">ESRI World Imagery (Wayback)</span></div>
    <div class="field"><span class="label">Total Historical Dates</span><span class="value">${images.length}</span></div>
  </div>`;

  if (images.length) {
    html += `<div class="section"><h2>Historical Imagery Timeline</h2><table><thead><tr><th>#</th><th>Date</th><th>Release ID</th></tr></thead><tbody>`;
    images.forEach((img, i) => {
      html += `<tr><td>${i + 1}</td><td>${img.label || img.date || 'N/A'}</td><td style="font-family:monospace;font-size:12px">${img.id || ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  if (carrier) {
    html += `<div class="section"><h2>Imagery Analysis Notes</h2><p style="font-size:13px;color:#555">Historical satellite imagery reviewed via ESRI Wayback service. Roof condition changes between dates may indicate storm damage or prior repairs. Cross-reference with weather event dates for carrier-defensible evidence.</p></div>`;
  }

  return html;
}

function buildPermitsBody(data, addr, carrier) {
  const permits = data?.permits || [];
  const propertyInfo = data?.propertyInfo || {};

  let html = `<div class="section"><h2>Property Information</h2>
    <div class="field"><span class="label">Address</span><span class="value">${addr}</span></div>`;
  if (propertyInfo.owner) html += `<div class="field"><span class="label">Owner</span><span class="value">${propertyInfo.owner}</span></div>`;
  if (propertyInfo.year_built) html += `<div class="field"><span class="label">Year Built</span><span class="value">${propertyInfo.year_built}</span></div>`;
  html += `<div class="field"><span class="label">Total Permits</span><span class="value">${permits.length}</span></div>
  </div>`;

  if (permits.length) {
    const roofPermits = permits.filter(p => (p.type || '').toLowerCase().includes('roof'));
    if (roofPermits.length) {
      html += `<div class="section"><h2>Roofing Permits (${roofPermits.length})</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Status</th></tr></thead><tbody>`;
      roofPermits.forEach(p => {
        html += `<tr><td>${p.date || 'N/A'}</td><td>${p.type || ''}</td><td>${p.description || ''}</td><td><span class="badge badge-orange">${p.status || 'unknown'}</span></td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    const otherPermits = permits.filter(p => !(p.type || '').toLowerCase().includes('roof'));
    if (otherPermits.length) {
      html += `<div class="section"><h2>Other Permits (${otherPermits.length})</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Status</th></tr></thead><tbody>`;
      otherPermits.forEach(p => {
        html += `<tr><td>${p.date || 'N/A'}</td><td>${p.type || ''}</td><td>${p.description || ''}</td><td>${p.status || ''}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
  }

  if (carrier) {
    html += `<div class="section"><h2>Permit Analysis</h2><p style="font-size:13px;color:#555">Permit records sourced from county property appraiser public records. Prior roof work permits are highlighted for carrier review.</p></div>`;
  }

  return html;
}

export default ReportGenerator;
