import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Download, ExternalLink, ChevronDown } from 'lucide-react';
import { useGamma } from '../../hooks/useGamma';

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
  const { createDeck, loading: gammaLoading, error: gammaError } = useGamma();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const types = REPORT_TYPES[context] || REPORT_TYPES.dol_discovery;

  const generate = async (reportType) => {
    setGenerating(true);
    setLastResult(null);
    try {
      const data = typeof getData === 'function' ? getData() : {};
      if (!data || (Object.keys(data).length === 0)) {
        toast.error('No data to generate report. Run a search first.');
        return;
      }

      const content = buildContent(context, reportType.key, data, address);
      const audience = reportType.key === 'carrier_facing' ? 'settlement' : 'client_update';

      // Primary: Gamma presentation
      try {
        const result = await createDeck({
          title: `${reportType.label} — ${address || data?.address || 'Property'}`,
          content,
          audience,
        });
        setLastResult(result);
        toast.success('Gamma presentation created');
        return;
      } catch (gammaErr) {
        console.warn('[Report] Gamma failed, falling back to HTML:', gammaErr.message);
      }

      // Fallback: downloadable HTML report
      const html = buildHtmlReport(context, reportType.key, data, address);
      downloadHtml(html, `${context}_${reportType.key}_report.html`);
      toast.success('Report downloaded (HTML fallback)');
    } catch (err) {
      console.error('Report generation failed:', err);
      toast.error(err?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadFallback = () => {
    const data = typeof getData === 'function' ? getData() : {};
    if (!data || (Object.keys(data).length === 0)) {
      toast.error('No data. Run a search first.');
      return;
    }
    const html = buildHtmlReport(context, 'carrier_facing', data, address);
    downloadHtml(html, `${context}_report.html`);
    toast.success('Report downloaded');
  };

  const busy = generating || gammaLoading;

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
        <>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {types.map((rt) => (
              <button
                key={rt.key}
                onClick={() => generate(rt)}
                disabled={busy}
                className="text-left p-3 rounded-lg border border-zinc-800/60 bg-zinc-950/30 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all disabled:opacity-50 group"
              >
                <div className="flex items-center gap-2">
                  {busy ? (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                  )}
                  <span className="text-sm text-zinc-200 font-mono">{rt.label}</span>
                </div>
                <p className="text-xs text-zinc-600 mt-1">{rt.desc}</p>
              </button>
            ))}
          </div>

          {/* Quick HTML download button */}
          <button
            onClick={downloadFallback}
            className="mt-2 flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download as HTML
          </button>
        </>
      )}

      {/* Gamma result link */}
      {lastResult?.url && open && (
        <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
          <ExternalLink className="w-4 h-4 text-green-400 flex-shrink-0" />
          <a href={lastResult.url} target="_blank" rel="noopener noreferrer" className="text-sm text-green-300 underline truncate">
            {lastResult.url}
          </a>
        </div>
      )}

      {gammaError && open && (
        <p className="mt-2 text-xs text-red-400">{gammaError}</p>
      )}
    </div>
  );
};

// ── Content builder for Gamma ────────────────────────────────────────

function buildContent(context, reportKey, data, address) {
  const carrier = reportKey === 'carrier_facing';
  const addr = address || data?.address || 'Property';

  if (context === 'dol_discovery') {
    const candidates = data?.candidates || [];
    const topCandidate = candidates[0];
    let lines = [`Property: ${addr}`];
    if (topCandidate) {
      lines.push(`Recommended DOL: ${topCandidate.candidate_date || topCandidate.date || 'N/A'}`);
      lines.push(`Confidence: ${topCandidate.confidence || 'N/A'}`);
      lines.push(`Peak Wind: ${topCandidate.peak_wind_mph ? `${Math.round(topCandidate.peak_wind_mph)} mph` : 'N/A'}`);
      lines.push(`Stations: ${topCandidate.station_count || 0}`);
      lines.push(`Summary: ${topCandidate.event_summary || topCandidate.explanation || ''}`);
      if (topCandidate.carrier_response) {
        lines.push(`Carrier Response: ${topCandidate.carrier_response}`);
      }
    }
    if (candidates.length > 1) {
      lines.push(`\nAlternate candidates: ${candidates.slice(1).map(c => c.candidate_date || c.date).join(', ')}`);
    }
    if (carrier) {
      lines.push('\nPresentation should emphasize data sources, weather station distances, and carrier-defensible evidence.');
    } else {
      lines.push('\nPresentation should be homeowner-friendly with clear timeline of weather events affecting the property.');
    }
    return lines.join('\n');
  }

  if (context === 'property_imagery') {
    const images = data?.images || [];
    let lines = [`Property: ${addr}`];
    if (images.length) {
      lines.push(`Historical imagery dates: ${images.map(i => i.date || i.label).join(', ')}`);
    }
    if (carrier) {
      lines.push('\nPresentation should show before/after roof condition from satellite imagery for carrier evidence.');
    } else {
      lines.push('\nPresentation should show property condition timeline in an easy-to-understand format for the homeowner.');
    }
    return lines.join('\n');
  }

  if (context === 'permits') {
    const permits = data?.permits || [];
    const propertyInfo = data?.propertyInfo || {};
    let lines = [`Property: ${addr}`];
    if (propertyInfo.owner) lines.push(`Owner: ${propertyInfo.owner}`);
    if (propertyInfo.year_built) lines.push(`Year Built: ${propertyInfo.year_built}`);
    lines.push(`Total Permits: ${permits.length}`);
    const roofPermits = permits.filter(p => (p.type || '').toLowerCase().includes('roof'));
    if (roofPermits.length) {
      lines.push(`Roofing Permits: ${roofPermits.length}`);
      roofPermits.forEach(p => {
        lines.push(`  - ${p.date || 'N/A'}: ${p.description || p.type || 'Roof permit'} (${p.status || 'unknown'})`);
      });
    }
    if (carrier) {
      lines.push('\nPresentation should highlight prior roof work, permit timelines, and implications for claim scope.');
    } else {
      lines.push('\nPresentation should summarize permit history in plain language for the homeowner.');
    }
    return lines.join('\n');
  }

  return `Property: ${addr}\n${JSON.stringify(data, null, 2)}`;
}

// ── HTML fallback ────────────────────────────────────────────────────

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

function buildHtmlReport(context, reportKey, data, address) {
  const carrier = reportKey === 'carrier_facing';
  const addr = address || data?.address || 'Property';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = carrier ? 'Carrier-Facing Report' : 'Client Summary Report';

  let body = '';
  if (context === 'dol_discovery') body = buildDolBody(data, addr, carrier);
  else if (context === 'property_imagery') body = buildImageryBody(data, addr, carrier);
  else if (context === 'permits') body = buildPermitsBody(data, addr, carrier);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${addr}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
  .header { border-bottom: 3px solid #ea580c; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 24px; color: #ea580c; margin-bottom: 4px; }
  .header .subtitle { font-size: 14px; color: #666; }
  .header .meta { font-size: 12px; color: #999; margin-top: 8px; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 18px; color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 12px; }
  .field { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
  .field .label { font-weight: 600; min-width: 160px; color: #555; font-size: 13px; }
  .field .value { color: #1a1a1a; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #f8f8f8; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #555; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
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
  if (location.latitude) html += `<div class="field"><span class="label">Coordinates</span><span class="value">${location.latitude}, ${location.longitude}</span></div>`;
  html += `</div>`;
  if (top) {
    const topDate = top.candidate_date || top.date || 'N/A';
    const topSummary = top.event_summary || top.explanation || '';
    const sc = top.score_components;
    html += `<div class="section"><h2>Recommended Date of Loss</h2>
      <div class="field"><span class="label">Date</span><span class="value" style="font-size:16px;font-weight:700;color:#ea580c">${topDate}</span></div>
      <div class="field"><span class="label">Confidence</span><span class="value"><span class="badge badge-green">${(top.confidence || 'N/A').toUpperCase()}</span></span></div>`;
    if (top.peak_wind_mph) html += `<div class="field"><span class="label">Peak Wind</span><span class="value">${Math.round(top.peak_wind_mph)} mph</span></div>`;
    if (top.station_count) html += `<div class="field"><span class="label">Stations</span><span class="value">${top.station_count}</span></div>`;
    if (sc) html += `<div class="field"><span class="label">Composite Score</span><span class="value">${Math.round((sc.composite_score || 0) * 100)}%</span></div>`;
    html += `<div class="field"><span class="label">Summary</span><span class="value">${topSummary}</span></div>`;
    if (top.carrier_response) {
      html += `<div class="field"><span class="label">Carrier Response</span><span class="value">${top.carrier_response}</span></div>`;
    }
    html += `</div>`;
    if (top.why_bullets?.length > 0) {
      html += `<div class="section"><h2>Supporting Evidence</h2><ul style="margin:8px 0 0 18px">`;
      top.why_bullets.forEach(b => { html += `<li style="margin-bottom:4px;font-size:13px">${b}</li>`; });
      html += `</ul></div>`;
    }
  }
  if (candidates.length > 1) {
    html += `<div class="section"><h2>Alternate Candidates</h2><table><thead><tr><th>Date</th><th>Confidence</th><th>Peak Wind</th><th>Summary</th></tr></thead><tbody>`;
    candidates.slice(1).forEach(c => {
      const d = c.candidate_date || c.date || 'N/A';
      const wind = c.peak_wind_mph ? `${Math.round(c.peak_wind_mph)} mph` : '—';
      html += `<tr><td>${d}</td><td><span class="badge badge-blue">${(c.confidence || 'N/A').toUpperCase()}</span></td><td>${wind}</td><td>${c.event_summary || c.explanation || ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }
  return html;
}

function buildImageryBody(data, addr) {
  const images = data?.images || [];
  let html = `<div class="section"><h2>Property Information</h2>
    <div class="field"><span class="label">Address</span><span class="value">${addr}</span></div>
    <div class="field"><span class="label">Imagery Source</span><span class="value">ESRI World Imagery (Wayback)</span></div>
    <div class="field"><span class="label">Historical Dates</span><span class="value">${images.length}</span></div>
  </div>`;
  if (images.length) {
    html += `<div class="section"><h2>Imagery Timeline</h2><table><thead><tr><th>#</th><th>Date</th><th>Release</th></tr></thead><tbody>`;
    images.forEach((img, i) => { html += `<tr><td>${i + 1}</td><td>${img.label || img.date || 'N/A'}</td><td style="font-family:monospace;font-size:12px">${img.id || ''}</td></tr>`; });
    html += `</tbody></table></div>`;
  }
  return html;
}

function buildPermitsBody(data, addr) {
  const permits = data?.permits || [];
  const info = data?.propertyInfo || {};
  let html = `<div class="section"><h2>Property Information</h2>
    <div class="field"><span class="label">Address</span><span class="value">${addr}</span></div>`;
  if (info.owner) html += `<div class="field"><span class="label">Owner</span><span class="value">${info.owner}</span></div>`;
  if (info.year_built) html += `<div class="field"><span class="label">Year Built</span><span class="value">${info.year_built}</span></div>`;
  html += `<div class="field"><span class="label">Total Permits</span><span class="value">${permits.length}</span></div></div>`;
  if (permits.length) {
    html += `<div class="section"><h2>Permit History</h2><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Status</th></tr></thead><tbody>`;
    permits.forEach(p => { html += `<tr><td>${p.date || 'N/A'}</td><td>${p.type || ''}</td><td>${p.description || ''}</td><td><span class="badge badge-orange">${p.status || ''}</span></td></tr>`; });
    html += `</tbody></table></div>`;
  }
  return html;
}

export default ReportGenerator;
