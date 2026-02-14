import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Download, ExternalLink, ChevronDown } from 'lucide-react';
import { useGamma, GAMMA_AUDIENCES } from '../../hooks/useGamma';

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

/**
 * Reusable report generation bar that sits at the bottom of each Intel Hub tab.
 * Uses Gamma to generate presentations, or falls back to a structured summary.
 *
 * Props:
 *   context  - 'dol_discovery' | 'property_imagery' | 'permits'
 *   getData  - () => object  — returns the current tab's data for the report
 *   address  - string (optional, for labelling)
 */
const ReportGenerator = ({ context = 'dol_discovery', getData, address }) => {
  const { createDeck, loading: gammaLoading, error: gammaError } = useGamma();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const types = REPORT_TYPES[context] || REPORT_TYPES.dol_discovery;

  const generate = async (reportType) => {
    setGenerating(true);
    try {
      const data = typeof getData === 'function' ? getData() : {};

      // Build content string from the tab's current data
      const content = buildContent(context, reportType.key, data, address);

      const audience = reportType.key === 'carrier_facing' ? 'settlement' : 'client_update';

      const result = await createDeck({
        title: `${reportType.label} — ${address || 'Property'}`,
        content,
        audience,
      });

      setLastResult(result);
      toast.success('Report generated');
    } catch (err) {
      console.error('Report generation failed:', err);
      toast.error(err?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
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
      )}

      {/* Result link */}
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

// ── helpers ──────────────────────────────────────────────────────────

function buildContent(context, reportKey, data, address) {
  const carrier = reportKey === 'carrier_facing';
  const addr = address || data?.address || 'Property';

  if (context === 'dol_discovery') {
    const candidates = data?.candidates || [];
    const topCandidate = candidates[0];
    let lines = [`Property: ${addr}`];
    if (topCandidate) {
      lines.push(`Recommended DOL: ${topCandidate.date || 'N/A'}`);
      lines.push(`Confidence: ${topCandidate.confidence || 'N/A'}`);
      lines.push(`Explanation: ${topCandidate.explanation || ''}`);
    }
    if (candidates.length > 1) {
      lines.push(`\nAlternate candidates: ${candidates.slice(1).map(c => c.date).join(', ')}`);
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
    if (data?.yearBuilt) lines.push(`Year Built: ${data.yearBuilt}`);
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

export default ReportGenerator;
