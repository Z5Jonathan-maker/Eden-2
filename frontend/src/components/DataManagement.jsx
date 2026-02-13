import React from 'react';
import { Download, Upload, FileSpreadsheet, FileJson, Database } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import { toast } from 'sonner';
import { apiGet, apiPost, API_URL } from '@/lib/api';
const IMPORT_MAPPING_PRESETS_KEY = 'eden_data_import_mapping_presets_v1';
const IMPORT_MAPPING_PREFERRED_PRESET_KEY = 'eden_data_import_preferred_preset_v1';
const IMPORT_MAPPING_PRESET_LOCK_KEY = 'eden_data_import_preset_lock_v1';
const FRONTEND_HEADER_ALIASES = {
  claim_number: ['claim number', 'claim #', 'claim id', 'claim', 'file number', 'id'],
  client_name: [
    'client name',
    'insured name',
    'insured',
    'policyholder',
    'policyholder name',
    'homeowner',
  ],
  client_email: [
    'client email',
    'email',
    'e-mail',
    'email address',
    'policyholder email',
    'claim email',
  ],
  property_address: ['property address', 'loss address', 'address', 'street address'],
  date_of_loss: ['date of loss', 'dol', 'loss date'],
  claim_type: ['claim type', 'type', 'loss type', 'peril'],
  policy_number: ['policy number', 'policy #', 'policy no', 'policy'],
  estimated_value: ['estimated value', 'estimate', 'claim value', 'amount', 'value'],
  description: ['description', 'notes', 'summary', 'details', 'comments'],
  status: ['status', 'claim status', 'stage'],
  priority: ['priority', 'severity'],
  assigned_to: ['assigned to', 'adjuster', 'owner', 'assignee'],
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-_/]+/g, ' ');
}

function summarizeImportReportRows(rows) {
  const reportRows = Array.isArray(rows) ? rows : [];
  const totals = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    warnings: 0,
    wouldImport: 0,
    wouldUpdate: 0,
  };
  const reasonCounts = {};

  reportRows.forEach(function (entry) {
    const status = String(entry?.status || '').toLowerCase();
    const message = String(entry?.message || 'No message');

    if (status === 'imported') totals.imported += 1;
    else if (status === 'updated') totals.updated += 1;
    else if (status === 'skipped') totals.skipped += 1;
    else if (status === 'error') totals.errors += 1;
    else if (status === 'warning') totals.warnings += 1;
    else if (status === 'would_import') totals.wouldImport += 1;
    else if (status === 'would_update') totals.wouldUpdate += 1;

    if (status === 'skipped' || status === 'error' || status === 'warning') {
      const key = message.length > 120 ? message.slice(0, 120) + '...' : message;
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
    }
  });

  const topReasons = Object.entries(reasonCounts)
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .slice(0, 8)
    .map(function (entry) {
      return { reason: entry[0], count: entry[1] };
    });

  return { totals, topReasons };
}

function buildFrontendAutoMapping(headers, canonicalFields) {
  const nextMapping = {};
  const allowedFields = new Set((canonicalFields || []).map(String));

  (headers || []).forEach(function (header) {
    const normalizedHeader = normalizeHeader(header);
    if (!normalizedHeader) return;

    let resolvedField = '';
    for (const fieldName of Object.keys(FRONTEND_HEADER_ALIASES)) {
      if (!allowedFields.has(fieldName)) continue;
      const aliases = FRONTEND_HEADER_ALIASES[fieldName] || [];
      for (const alias of aliases) {
        const normalizedAlias = normalizeHeader(alias);
        if (!normalizedAlias) continue;
        if (
          normalizedHeader === normalizedAlias ||
          normalizedHeader.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedHeader)
        ) {
          resolvedField = fieldName;
          break;
        }
      }
      if (resolvedField) break;
    }

    if (resolvedField) {
      nextMapping[header] = resolvedField;
    }
  });

  return nextMapping;
}

function buildCompatibilityVerdict(lastImportPreview, importDiagnostics, lastImportSummary) {
  var unknownHeaders = Number(lastImportPreview?.unknown_header_count || 0);
  var skipped = Number(importDiagnostics?.totals?.skipped || 0);
  var errors = Number(importDiagnostics?.totals?.errors || 0);
  var warnings = Number(lastImportSummary?.warnings || 0);
  var totalRows = Number(lastImportSummary?.totalRows || 0);
  var hasDryRun = Boolean(lastImportSummary?.isDryRun);

  var issues = [];
  if (unknownHeaders > 0) issues.push(unknownHeaders + ' unmapped column(s)');
  if (errors > 0) issues.push(errors + ' row error(s)');
  if (skipped > 0) issues.push(skipped + ' row(s) will be skipped');
  if (warnings > 0) issues.push(warnings + ' warning(s)');

  var severity = 'good';
  if (!hasDryRun) severity = 'pending';
  if (unknownHeaders > 0 || warnings > 0 || skipped > 0) severity = 'warn';
  if (errors > 0) severity = 'critical';

  var label = 'Ready';
  if (severity === 'pending') label = 'Needs Dry Run';
  if (severity === 'warn') label = 'Review Required';
  if (severity === 'critical') label = 'Blocking Issues';

  var coverage =
    totalRows > 0
      ? Math.max(0, Math.min(100, Math.round(((totalRows - skipped - errors) / totalRows) * 100)))
      : 0;

  return {
    severity,
    label,
    issues,
    coverage,
    hasDryRun,
    totalRows,
  };
}

function hasEnhancedImportResponseShape(data) {
  return (
    Object.prototype.hasOwnProperty.call(data || {}, 'duplicate_strategy') ||
    Object.prototype.hasOwnProperty.call(data || {}, 'updated')
  );
}

function extractErrorDetail(payload) {
  if (!payload) return '';
  if (typeof payload.detail === 'string') return payload.detail;
  if (typeof payload.message === 'string') return payload.message;
  return '';
}

function isCsvOnlyError(payload) {
  var detail = String(extractErrorDetail(payload) || '').toLowerCase();
  return detail.includes('only csv');
}

async function convertSpreadsheetToCsvFile(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName =
    Array.isArray(workbook.SheetNames) && workbook.SheetNames.length > 0
      ? workbook.SheetNames[0]
      : '';
  if (!firstSheetName || !workbook.Sheets[firstSheetName]) {
    throw new Error('Unable to read spreadsheet content');
  }
  const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], { FS: ',', RS: '\n' });
  const baseName = String(file.name || 'import').replace(/\.[^.]+$/, '');
  return new File([csvText], baseName + '.csv', { type: 'text/csv' });
}

function DataManagement() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [lastImportSummary, setLastImportSummary] = React.useState(null);
  const [lastImportReportRows, setLastImportReportRows] = React.useState([]);
  const [lastImportPreview, setLastImportPreview] = React.useState(null);
  const [duplicateStrategy, setDuplicateStrategy] = React.useState('skip');
  const [backendSupportsDuplicateStrategy, setBackendSupportsDuplicateStrategy] =
    React.useState(null);
  const [importCapabilitiesLoading, setImportCapabilitiesLoading] = React.useState(true);
  const [importCapabilitiesError, setImportCapabilitiesError] = React.useState('');
  const [importCapabilities, setImportCapabilities] = React.useState(null);
  const [availableDuplicateStrategies, setAvailableDuplicateStrategies] = React.useState([
    'skip',
    'auto_renumber',
    'update_blank_fields',
  ]);
  const [importColumnMapping, setImportColumnMapping] = React.useState({});
  const [mappingPresets, setMappingPresets] = React.useState([]);
  const [preferredPresetId, setPreferredPresetId] = React.useState('');
  const [presetLockEnabled, setPresetLockEnabled] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const importDiagnostics = React.useMemo(
    function () {
      return summarizeImportReportRows(lastImportReportRows);
    },
    [lastImportReportRows]
  );
  const compatibilityVerdict = React.useMemo(
    function () {
      return buildCompatibilityVerdict(lastImportPreview, importDiagnostics, lastImportSummary);
    },
    [lastImportPreview, importDiagnostics, lastImportSummary]
  );

  React.useEffect(function () {
    try {
      var raw = localStorage.getItem(IMPORT_MAPPING_PRESETS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      setMappingPresets(Array.isArray(parsed) ? parsed : []);
      setPreferredPresetId(localStorage.getItem(IMPORT_MAPPING_PREFERRED_PRESET_KEY) || '');
      setPresetLockEnabled(localStorage.getItem(IMPORT_MAPPING_PRESET_LOCK_KEY) === 'true');
    } catch (_err) {
      setMappingPresets([]);
    }
  }, []);

  function persistMappingPresets(nextPresets) {
    setMappingPresets(nextPresets);
    try {
      localStorage.setItem(IMPORT_MAPPING_PRESETS_KEY, JSON.stringify(nextPresets));
    } catch (_err) {}
  }

  function persistPresetPreferences(nextPreferredPresetId, nextLockEnabled) {
    setPreferredPresetId(nextPreferredPresetId);
    setPresetLockEnabled(nextLockEnabled);
    try {
      localStorage.setItem(IMPORT_MAPPING_PREFERRED_PRESET_KEY, nextPreferredPresetId || '');
      localStorage.setItem(IMPORT_MAPPING_PRESET_LOCK_KEY, nextLockEnabled ? 'true' : 'false');
    } catch (_err) {}
  }

  const probeLegacyImportCapabilities = React.useCallback(async function probeLegacyImportCapabilities() {
    var probeCsv = ['claim_number,client_name,property_address'].join('\n');
    var probeBlob = new Blob([probeCsv], { type: 'text/csv;charset=utf-8;' });
    var probeFile = new File([probeBlob], 'eden_capability_probe.csv', { type: 'text/csv' });
    var formData = new FormData();
    formData.append('file', probeFile);
    formData.append('import_mapping', JSON.stringify({}));
    formData.append('duplicate_strategy', 'auto_renumber');
    formData.append('dry_run', 'true');

    try {
      const res = await apiPost('/api/data/import/claims', formData, { isFormData: true });
      if (!res.ok || !res.data || res.data.success !== true) {
        throw new Error(extractErrorDetail(res.data) || 'Capability probe failed');
      }
      const data = res.data;
      var enhanced = hasEnhancedImportResponseShape(data);
      setBackendSupportsDuplicateStrategy(enhanced);
      setAvailableDuplicateStrategies(
        enhanced ? ['skip', 'auto_renumber', 'update_blank_fields'] : ['skip']
      );
      setDuplicateStrategy(function (currentStrategy) {
        if (!enhanced) return 'skip';
        return ['skip', 'auto_renumber', 'update_blank_fields'].includes(currentStrategy)
          ? currentStrategy
          : 'skip';
      });
      setImportCapabilities({
        success: true,
        legacy_probe: true,
        supports_duplicate_strategy: enhanced,
        duplicate_strategies: enhanced
          ? ['skip', 'auto_renumber', 'update_blank_fields']
          : ['skip'],
        accepted_extensions: ['.csv', '.xlsx', '.xls'],
      });
      setImportCapabilitiesError(
        'Capabilities endpoint unavailable: using probe-based compatibility mode.'
      );
    } catch (err) {
      setBackendSupportsDuplicateStrategy(false);
      setAvailableDuplicateStrategies(['skip']);
      setDuplicateStrategy('skip');
      setImportCapabilities({
        success: true,
        legacy_probe: true,
        supports_duplicate_strategy: false,
        duplicate_strategies: ['skip'],
        accepted_extensions: ['.csv', '.xlsx', '.xls'],
      });
      setImportCapabilitiesError(
        'Capabilities endpoint unavailable: running in safe legacy mode.'
      );
    } finally {
      setImportCapabilitiesLoading(false);
    }
  }, []);

  function scorePresetForHeaders(preset, detectedHeaders) {
    var presetHeaders = String(preset?.headerFingerprint || '')
      .split('|')
      .map(function (v) {
        return String(v || '').trim();
      })
      .filter(Boolean);
    var currentHeaders = (detectedHeaders || [])
      .map(function (v) {
        return String(v || '').trim();
      })
      .filter(Boolean);
    if (!presetHeaders.length || !currentHeaders.length) return 0;
    var presetSet = new Set(presetHeaders);
    var currentSet = new Set(currentHeaders);
    var overlap = 0;
    currentSet.forEach(function (h) {
      if (presetSet.has(h)) overlap += 1;
    });
    // Jaccard-like score
    var union = new Set([].concat(Array.from(presetSet), Array.from(currentSet))).size || 1;
    return overlap / union;
  }

  function pickBestPreset(detectedHeaders) {
    if (!Array.isArray(mappingPresets) || mappingPresets.length === 0) return null;
    var best = null;
    var bestScore = 0;
    mappingPresets.forEach(function (preset) {
      var score = scorePresetForHeaders(preset, detectedHeaders);
      if (score > bestScore) {
        bestScore = score;
        best = preset;
      }
    });
    if (!best || bestScore < 0.5) return null;
    return { preset: best, score: bestScore };
  }

  const fetchStats = React.useCallback(async function fetchStats() {
    setLoading(true);
    try {
      const res = await apiGet('/api/data/stats');
      if (res.ok) setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(
    function () {
      fetchStats();
    },
    [fetchStats]
  );

  React.useEffect(
    function () {
      const fetchCapabilities = async function () {
        setImportCapabilitiesLoading(true);
        setImportCapabilitiesError('');
        try {
          const res = await apiGet('/api/data/import/claims/capabilities');
          if (!res.ok || !res.data || res.data.success !== true) {
            probeLegacyImportCapabilities();
            return;
          }
          setImportCapabilities(res.data);
          if (Array.isArray(res.data.duplicate_strategies) && res.data.duplicate_strategies.length > 0) {
            setAvailableDuplicateStrategies(res.data.duplicate_strategies);
            setDuplicateStrategy(function (currentStrategy) {
              return res.data.duplicate_strategies.includes(currentStrategy)
                ? currentStrategy
                : res.data.duplicate_strategies[0];
            });
          }
          setBackendSupportsDuplicateStrategy(res.data.supports_duplicate_strategy === true);
          setImportCapabilitiesLoading(false);
        } catch (err) {
          probeLegacyImportCapabilities();
        }
      };
      fetchCapabilities();
    },
    [probeLegacyImportCapabilities]
  );

  function handleExportCSV() {
    fetch(API_URL + '/api/data/export/claims', {
      credentials: 'include',
    })
      .then(function (res) {
        return res.blob();
      })
      .then(function (blob) {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'claims_export.csv';
        a.click();
      });
  }

  function handleExportJSON() {
    fetch(API_URL + '/api/data/export/claims/json', {
      credentials: 'include',
    })
      .then(function (res) {
        return res.blob();
      })
      .then(function (blob) {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'claims_export.json';
        a.click();
      });
  }

  function handleDownloadTemplate() {
    fetch(API_URL + '/api/data/template/claims', {
      credentials: 'include',
    })
      .then(function (res) {
        return res.blob();
      })
      .then(function (blob) {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'claims_template.csv';
        a.click();
      });
  }

  async function runLegacyDirectImport(file) {
    try {
      var formData = new FormData();
      formData.append('file', file);
      const res = await apiPost('/api/data/import/claims', formData);

      let data = res.ok ? res.data : { success: false, error: res.error };

      if (
        (!data || data.success !== true) &&
        isCsvOnlyError(data) &&
        /\.(xlsx|xls)$/i.test(String(file?.name || ''))
      ) {
        try {
          const csvFile = await convertSpreadsheetToCsvFile(file);
          var csvFormData = new FormData();
          csvFormData.append('file', csvFile);
          const csvRes = await apiPost('/api/data/import/claims', csvFormData);
          data = csvRes.ok ? csvRes.data : { success: false, error: csvRes.error };
          if (data && data.success === true) {
            toast.info('Legacy backend detected: converted XLSX to CSV automatically.');
          }
        } catch (_convertErr) {
          toast.error('Backend requires CSV. XLSX auto-conversion failed.');
        }
      }
      if (!data || data.success !== true) {
        toast.error(data && data.detail ? data.detail : 'Legacy import failed');
        return;
      }
      var reportRows = Array.isArray(data.row_report) ? data.row_report : [];
      setLastImportReportRows(reportRows);
      setLastImportSummary({
        imported: data.imported || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        warnings: data.warning_count || (Array.isArray(data.warnings) ? data.warnings.length : 0),
        errors: data.error_count || (Array.isArray(data.errors) ? data.errors.length : 0),
        totalRows: reportRows.length,
        isDryRun: false,
        wouldImport: data.would_import || 0,
        duplicateStrategy: data.duplicate_strategy || 'skip',
      });
      setBackendSupportsDuplicateStrategy(
        Object.prototype.hasOwnProperty.call(data || {}, 'duplicate_strategy') ||
          Object.prototype.hasOwnProperty.call(data || {}, 'updated')
      );
      toast.success('Legacy import completed');
      fetchStats();
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Legacy import failed');
    }
  }

  function applyDryRunResult(data) {
    if (!data || data.success !== true) {
      toast.error(data && data.detail ? data.detail : 'Dry run failed');
      return;
    }
    var supportsDuplicateStrategy =
      Object.prototype.hasOwnProperty.call(data || {}, 'duplicate_strategy') ||
      Object.prototype.hasOwnProperty.call(data || {}, 'updated');
    setBackendSupportsDuplicateStrategy(supportsDuplicateStrategy);
    var reportRows = Array.isArray(data.row_report) ? data.row_report : [];
    setLastImportReportRows(reportRows);
    setLastImportSummary({
      imported: 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
      warnings: data.warning_count || (Array.isArray(data.warnings) ? data.warnings.length : 0),
      errors: data.error_count || (Array.isArray(data.errors) ? data.errors.length : 0),
      totalRows: reportRows.length,
      isDryRun: true,
      wouldImport: data.would_import || 0,
      duplicateStrategy: data.duplicate_strategy || duplicateStrategy,
    });
    if (!supportsDuplicateStrategy && duplicateStrategy !== 'skip') {
      toast.warning(
        'Backend update required: duplicate strategy is not active yet, dry run uses default skip behavior.'
      );
    }
    toast.success(
      'Compatibility check complete: would import ' + (data.would_import || 0) + ' rows'
    );
  }

  async function runDryRunRequest(file, mappingOverride) {
    var formData = new FormData();
    formData.append('file', file);
    formData.append('import_mapping', JSON.stringify(mappingOverride || importColumnMapping || {}));
    formData.append('duplicate_strategy', duplicateStrategy);
    formData.append('dry_run', 'true');
    const res = await apiPost('/api/data/import/claims', formData);
    return res.data;
  }

  async function handleImport(e) {
    var file = e.target.files[0];
    if (!file) return;
    var previewFormData = new FormData();
    previewFormData.append('file', file);

    try {
      const res = await apiPost('/api/data/import/claims/preview', previewFormData);
      var preview = res.data;

      if (!res.ok) {
        // Legacy fallback for 404/405/501
        preview = { __legacyFallback: true };
      }

      {
        if (preview && preview.__legacyFallback) {
          setLastImportPreview(null);
          setImportColumnMapping({});
          toast.info('Preview endpoint unavailable. Falling back to direct import mode.');
          runLegacyDirectImport(file);
          return null;
        }
        if (!preview || preview.success !== true) {
          if (isCsvOnlyError(preview) && /\.(xlsx|xls)$/i.test(String(file?.name || ''))) {
            toast.info(
              'Preview endpoint is CSV-only. Falling back to direct import with auto-conversion.'
            );
            runLegacyDirectImport(file);
            return null;
          }
          toast.error(preview && preview.detail ? preview.detail : 'Import preview failed');
          return null;
        }
        setLastImportPreview(preview);
        var defaultMapping = {};
        (preview.header_mapping || []).forEach(function (item) {
          if (item && item.source_header && item.mapped_field) {
            defaultMapping[item.source_header] = item.mapped_field;
          }
        });
        const frontendAutoMapping = buildFrontendAutoMapping(
          preview.detected_headers || [],
          preview.canonical_fields || []
        );
        defaultMapping = { ...frontendAutoMapping, ...defaultMapping };
        var effectiveMapping = { ...defaultMapping };
        setImportColumnMapping(defaultMapping);
        var lockedPreset = presetLockEnabled
          ? mappingPresets.find(function (p) {
              return p.id === preferredPresetId;
            })
          : null;
        var chosenPresetResult = null;
        if (lockedPreset && lockedPreset.mapping) {
          chosenPresetResult = { preset: lockedPreset, score: 1 };
        } else {
          chosenPresetResult = pickBestPreset(preview.detected_headers || []);
        }
        if (chosenPresetResult && chosenPresetResult.preset && chosenPresetResult.preset.mapping) {
          var allowedHeaders = new Set((preview.detected_headers || []).map(String));
          var merged = { ...defaultMapping };
          Object.entries(chosenPresetResult.preset.mapping).forEach(function (entry) {
            var sourceHeader = entry[0];
            var mappedField = entry[1];
            if (allowedHeaders.has(String(sourceHeader))) {
              merged[sourceHeader] = mappedField;
            }
          });
          effectiveMapping = { ...merged };
          setImportColumnMapping(merged);
          if (lockedPreset) {
            toast.success('Applied locked preset: ' + chosenPresetResult.preset.name);
          } else {
            toast.success('Auto-applied preset: ' + chosenPresetResult.preset.name);
          }
        }
        if ((preview.unknown_header_count || 0) > 0) {
          toast.warning('Preview ready: review column mapping, then click "Apply Remap & Import".');
        } else {
          toast.success(
            'Preview ready: mappings detected. Click "Apply Remap & Import" to continue.'
          );
        }
        try {
          var dryRunData = await runDryRunRequest(file, effectiveMapping);
          applyDryRunResult(dryRunData);
        } catch (_dryRunErr) {
          toast.error('Compatibility check failed');
        }
        return null;
      }
    } catch (err) {
      toast.info('Preview failed. Falling back to direct import mode.');
      runLegacyDirectImport(file);
    }
  }

  async function handleApplyRemapAndImport() {
    if (!fileInputRef.current || !fileInputRef.current.files || !fileInputRef.current.files[0]) {
      toast.error('Select a file first');
      return;
    }
    var file = fileInputRef.current.files[0];
    var formData = new FormData();
    formData.append('file', file);
    formData.append('import_mapping', JSON.stringify(importColumnMapping || {}));
    formData.append('duplicate_strategy', duplicateStrategy);
    formData.append('dry_run', 'false');

    try {
      const res = await apiPost('/api/data/import/claims', formData);
      const data = res.data;
        if (!data || data.success !== true) {
          toast.error(data && data.detail ? data.detail : 'Import failed');
          return;
        }
        var supportsDuplicateStrategy =
          Object.prototype.hasOwnProperty.call(data || {}, 'duplicate_strategy') ||
          Object.prototype.hasOwnProperty.call(data || {}, 'updated');
        setBackendSupportsDuplicateStrategy(supportsDuplicateStrategy);
        var reportRows = Array.isArray(data.row_report) ? data.row_report : [];
        setLastImportReportRows(reportRows);
        setLastImportSummary({
          imported: data.imported || 0,
          updated: data.updated || 0,
          skipped: data.skipped || 0,
          warnings: data.warning_count || (Array.isArray(data.warnings) ? data.warnings.length : 0),
          errors: data.error_count || (Array.isArray(data.errors) ? data.errors.length : 0),
          totalRows: reportRows.length,
          isDryRun: false,
          wouldImport: data.would_import || 0,
          duplicateStrategy: data.duplicate_strategy || duplicateStrategy,
        });
        if (!supportsDuplicateStrategy && duplicateStrategy !== 'skip') {
          toast.warning(
            'Backend update required: duplicate strategy is not active yet, falling back to default skip behavior.'
          );
        }
        toast.success('Import completed with remapped columns');
        fetchStats();
    } catch (err) {
      toast.error('Import failed');
    }
  }

  function handleDryRunWithMapping() {
    if (!fileInputRef.current || !fileInputRef.current.files || !fileInputRef.current.files[0]) {
      toast.error('Select a file first');
      return;
    }
    var file = fileInputRef.current.files[0];
    runDryRunRequest(file)
      .then(function (data) {
        applyDryRunResult(data);
      })
      .catch(function () {
        toast.error('Dry run failed');
      });
  }

  function saveCurrentMappingPreset() {
    if (!lastImportPreview || !lastImportPreview.detected_headers) {
      toast.error('Run preview first');
      return;
    }
    var name = window.prompt('Preset name', 'CRM Mapping Preset');
    if (!name) return;
    var headerFingerprint = (lastImportPreview.detected_headers || []).map(String).sort().join('|');
    var preset = {
      id: 'preset_' + Date.now(),
      name: name.trim(),
      mapping: importColumnMapping || {},
      headerFingerprint: headerFingerprint,
      createdAt: new Date().toISOString(),
    };
    var nextPresets = [preset].concat(mappingPresets).slice(0, 20);
    persistMappingPresets(nextPresets);
    toast.success('Mapping preset saved');
  }

  function applyMappingPreset(presetId) {
    var preset = mappingPresets.find(function (item) {
      return item.id === presetId;
    });
    if (!preset || !preset.mapping) return;
    var allowedHeaders = new Set((lastImportPreview?.detected_headers || []).map(String));
    var filteredMapping = {};
    Object.entries(preset.mapping).forEach(function (entry) {
      var sourceHeader = entry[0];
      var mappedField = entry[1];
      if (allowedHeaders.has(String(sourceHeader))) {
        filteredMapping[sourceHeader] = mappedField;
      }
    });
    setImportColumnMapping(function (prev) {
      return { ...prev, ...filteredMapping };
    });
    persistPresetPreferences(presetId, presetLockEnabled);
    toast.success('Preset applied');
  }

  function deleteMappingPreset(presetId) {
    var nextPresets = mappingPresets.filter(function (item) {
      return item.id !== presetId;
    });
    persistMappingPresets(nextPresets);
    if (preferredPresetId === presetId) {
      persistPresetPreferences('', false);
    }
    toast.success('Preset removed');
  }

  function handleDownloadImportReport() {
    if (!lastImportReportRows.length) {
      toast.error('No import report available yet');
      return;
    }
    var headers = ['row', 'status', 'claim_number', 'message'];
    var csvRows = [headers.join(',')];
    lastImportReportRows.forEach(function (entry) {
      var row = headers.map(function (key) {
        var value =
          entry && entry[key] !== undefined && entry[key] !== null ? String(entry[key]) : '';
        return '"' + value.replace(/"/g, '""') + '"';
      });
      csvRows.push(row.join(','));
    });
    var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'claims_import_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter" data-testid="data-management-page">
      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <img
            src={NAV_ICONS.data_ops}
            alt="Data Ops"
            className="w-12 h-12 sm:w-14 sm:h-14 object-contain icon-3d-shadow"
          />
          <div>
            <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              DATA OPS
            </h1>
            <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">
              Import & Export Claims Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="card-tactical p-4 sm:p-5 mb-6 shadow-tactical" data-testid="db-stats-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Database Stats
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner-tactical w-8 h-8" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
            <div
              className="p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover-lift-sm"
              data-testid="stat-claims"
            >
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Claims
              </p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-blue-400">
                {stats.total_claims}
              </p>
            </div>
            <div
              className="p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover-lift-sm"
              data-testid="stat-users"
            >
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Users
              </p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-green-400">
                {stats.total_users}
              </p>
            </div>
            <div
              className="p-3 sm:p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover-lift-sm"
              data-testid="stat-notes"
            >
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Notes
              </p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-purple-400">
                {stats.total_notes}
              </p>
            </div>
            <div
              className="p-3 sm:p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover-lift-sm"
              data-testid="stat-notifications"
            >
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                Notifications
              </p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-orange-400">
                {stats.total_notifications}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Export */}
      <div className="card-tactical p-4 sm:p-5 mb-6 shadow-tactical" data-testid="export-card">
        <div className="mb-4">
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Export
          </h3>
          <p className="text-zinc-500 font-mono text-xs mt-1">Download claims data</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-sm uppercase flex items-center gap-2 hover:bg-green-500/20 hover:border-green-500/50 transition-all btn-press-effect"
            data-testid="export-csv-btn"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono text-sm uppercase flex items-center gap-2 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all btn-press-effect"
            data-testid="export-json-btn"
          >
            <FileJson className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card-tactical p-4 sm:p-5 shadow-tactical" data-testid="import-card">
        <div className="mb-4">
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Import
          </h3>
          <p className="text-zinc-500 font-mono text-xs mt-1">
            Step 1: Select file for preview. Step 2: Dry run or import.
          </p>
        </div>
        <div
          className="mb-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2"
          data-testid="import-engine-status"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              Import Engine Status
            </span>
            {importCapabilitiesLoading ? (
              <span className="text-[10px] font-mono text-zinc-400">Checking...</span>
            ) : backendSupportsDuplicateStrategy ? (
              <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                Enhanced
              </span>
            ) : (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                Legacy
              </span>
            )}
          </div>
          {!importCapabilitiesLoading && importCapabilities ? (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
              <div>
                Extensions:{' '}
                {(importCapabilities.accepted_extensions || []).join(', ') || '.csv,.xlsx,.xls'}
              </div>
              <div>
                Strategies: {(importCapabilities.duplicate_strategies || []).join(', ') || 'skip'}
              </div>
              {importCapabilities.legacy_probe ? (
                <div className="sm:col-span-2 text-cyan-300">
                  Mode: Probe-based compatibility fallback
                </div>
              ) : null}
            </div>
          ) : null}
          {!importCapabilitiesLoading && importCapabilitiesError ? (
            <div className="mt-2 text-[10px] font-mono text-amber-300">
              {importCapabilitiesError}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 font-mono text-sm uppercase flex items-center gap-2 hover:border-orange-500/30 hover:text-orange-400 transition-all btn-press-effect"
            data-testid="download-template-btn"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={function () {
              fileInputRef.current.click();
            }}
            className="btn-tactical px-4 py-2.5 text-sm flex items-center gap-2"
            data-testid="import-csv-btn"
          >
            <Upload className="w-4 h-4" />
            Select File (Preview)
          </button>
          <button
            onClick={handleDownloadImportReport}
            disabled={!lastImportReportRows.length}
            className="px-4 py-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-mono text-sm uppercase flex items-center gap-2 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="download-import-report-btn"
          >
            <Download className="w-4 h-4" />
            Download Import Report
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              Duplicates
            </span>
            <select
              value={duplicateStrategy}
              onChange={function (ev) {
                setDuplicateStrategy(ev.target.value);
              }}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100"
              data-testid="duplicate-strategy-select"
              disabled={backendSupportsDuplicateStrategy === false}
            >
              {availableDuplicateStrategies.includes('skip') && <option value="skip">Skip</option>}
              {availableDuplicateStrategies.includes('auto_renumber') && (
                <option value="auto_renumber">Auto renumber</option>
              )}
              {availableDuplicateStrategies.includes('update_blank_fields') && (
                <option value="update_blank_fields">Update blank fields</option>
              )}
            </select>
          </div>
        </div>
        {backendSupportsDuplicateStrategy === false ? (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-mono text-amber-200">
            Backend import endpoint is on older version. Duplicate strategy controls are queued but
            not active until backend is redeployed.
          </div>
        ) : null}
        {lastImportPreview ? (
          <div
            className="mt-3 rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-3"
            data-testid="compatibility-verdict"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-zinc-200 font-mono text-xs uppercase tracking-wider">
                Compatibility Verdict
              </p>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                  compatibilityVerdict.severity === 'good'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : compatibilityVerdict.severity === 'warn'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : compatibilityVerdict.severity === 'critical'
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : 'border-zinc-600 bg-zinc-800/70 text-zinc-300'
                }`}
              >
                {compatibilityVerdict.label}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="text-zinc-300">Coverage: {compatibilityVerdict.coverage}%</div>
              <div className="text-cyan-300">
                Rows Checked: {compatibilityVerdict.totalRows || 0}
              </div>
              <div className="text-emerald-300">
                Would Import: {lastImportSummary?.wouldImport || 0}
              </div>
              <div className="text-zinc-300">
                Dry Run: {compatibilityVerdict.hasDryRun ? 'Yes' : 'Pending'}
              </div>
            </div>
            {compatibilityVerdict.issues.length > 0 ? (
              <div className="mt-2 space-y-1">
                {compatibilityVerdict.issues.slice(0, 4).map(function (issue, idx) {
                  return (
                    <div
                      key={'compat-issue-' + idx}
                      className="text-[11px] text-zinc-300 font-mono"
                    >
                      - {issue}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-emerald-300 font-mono">
                No compatibility issues detected in dry run.
              </div>
            )}
          </div>
        ) : null}
        {lastImportSummary ? (
          <div
            className="mt-4 p-3 rounded-lg border border-zinc-700/60 bg-zinc-900/50"
            data-testid="import-summary"
          >
            <p className="text-zinc-200 font-mono text-xs uppercase tracking-wider mb-2">
              Last Import Summary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
              <div className="text-emerald-300">
                {lastImportSummary.isDryRun ? 'Would Import' : 'Imported'}:{' '}
                {lastImportSummary.isDryRun
                  ? lastImportSummary.wouldImport || 0
                  : lastImportSummary.imported}
              </div>
              <div className="text-cyan-300">Updated: {lastImportSummary.updated || 0}</div>
              <div className="text-zinc-300">Skipped: {lastImportSummary.skipped}</div>
              <div className="text-amber-300">Warnings: {lastImportSummary.warnings}</div>
              <div className="text-red-300">Errors: {lastImportSummary.errors}</div>
              <div className="text-cyan-300">Rows: {lastImportSummary.totalRows}</div>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              Duplicate Strategy:{' '}
              {String(lastImportSummary.duplicateStrategy || duplicateStrategy).replace(/_/g, ' ')}
            </div>
          </div>
        ) : null}
        {lastImportReportRows.length > 0 ? (
          <div
            className="mt-3 p-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40"
            data-testid="import-diagnostics"
          >
            <p className="text-zinc-200 font-mono text-xs uppercase tracking-wider mb-2">
              Import Diagnostics
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="text-emerald-300">Imported: {importDiagnostics.totals.imported}</div>
              <div className="text-cyan-300">Updated: {importDiagnostics.totals.updated}</div>
              <div className="text-zinc-300">Skipped: {importDiagnostics.totals.skipped}</div>
              <div className="text-red-300">Errors: {importDiagnostics.totals.errors}</div>
            </div>
            {importDiagnostics.topReasons.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
                  Top Skip/Error Reasons
                </p>
                {importDiagnostics.topReasons.map(function (item, idx) {
                  return (
                    <div
                      key={'reason-' + idx}
                      className="flex items-start justify-between gap-3 rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1.5"
                    >
                      <span className="text-[11px] text-zinc-300 font-mono">{item.reason}</span>
                      <span className="text-[10px] text-amber-300 font-mono whitespace-nowrap">
                        x{item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                No warnings or errors in last report
              </div>
            )}
          </div>
        ) : null}
        {lastImportPreview ? (
          <div
            className="mt-3 p-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40"
            data-testid="import-preview-summary"
          >
            <p className="text-zinc-200 font-mono text-xs uppercase tracking-wider mb-2">
              Last Import Preview
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="text-cyan-300">Rows: {lastImportPreview.total_rows || 0}</div>
              <div className="text-emerald-300">
                Mapped: {lastImportPreview.mapped_header_count || 0}
              </div>
              <div className="text-amber-300">
                Unknown: {lastImportPreview.unknown_header_count || 0}
              </div>
              <div className="text-zinc-300">
                Headers: {(lastImportPreview.detected_headers || []).length}
              </div>
            </div>
            {Array.isArray(lastImportPreview.header_mapping) &&
            lastImportPreview.header_mapping.length > 0 ? (
              <div className="mt-3 max-h-64 overflow-auto border border-zinc-800 rounded-lg">
                <div className="px-3 py-2 text-[10px] text-zinc-500 uppercase font-mono tracking-wider border-b border-zinc-800">
                  Column Mapping (adjust before import)
                </div>
                {mappingPresets.length > 0 && (
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wide mb-1">
                      Mapping Presets
                    </p>
                    <div className="mb-2 space-y-1">
                      <select
                        value={preferredPresetId}
                        onChange={function (ev) {
                          persistPresetPreferences(ev.target.value, presetLockEnabled);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-100"
                      >
                        <option value="">No preferred preset</option>
                        {mappingPresets.map(function (preset) {
                          return (
                            <option key={'preferred-' + preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          );
                        })}
                      </select>
                      <label className="flex items-center justify-between rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200">
                        <span>Lock to preferred preset</span>
                        <input
                          type="checkbox"
                          checked={presetLockEnabled}
                          onChange={function (ev) {
                            persistPresetPreferences(preferredPresetId, ev.target.checked);
                          }}
                          className="h-3.5 w-3.5 accent-cyan-400"
                        />
                      </label>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {mappingPresets.slice(0, 8).map(function (preset) {
                        return (
                          <div key={preset.id} className="flex items-center gap-1">
                            <button
                              onClick={function () {
                                applyMappingPreset(preset.id);
                              }}
                              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-[10px] text-zinc-200 hover:border-cyan-400/40"
                              title={preset.name}
                            >
                              {preset.name}
                            </button>
                            <button
                              onClick={function () {
                                deleteMappingPreset(preset.id);
                              }}
                              className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-1 text-[10px] text-red-200 hover:bg-red-500/20"
                            >
                              Del
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 p-3">
                  {lastImportPreview.header_mapping.map(function (mapItem, idx) {
                    var sourceHeader = mapItem.source_header;
                    var mappedField = importColumnMapping[sourceHeader] || '';
                    return (
                      <div
                        key={sourceHeader + '_' + idx}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      >
                        <div
                          className="text-xs text-zinc-300 font-mono truncate"
                          title={sourceHeader}
                        >
                          {sourceHeader}
                        </div>
                        <select
                          value={mappedField}
                          onChange={function (ev) {
                            var nextField = ev.target.value;
                            setImportColumnMapping(function (prev) {
                              return { ...prev, [sourceHeader]: nextField };
                            });
                          }}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="">Ignore</option>
                          {(lastImportPreview.canonical_fields || []).map(function (field) {
                            return (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 pb-3">
                  <button
                    onClick={saveCurrentMappingPreset}
                    className="mb-2 w-full px-3 py-2 rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-200 font-mono text-xs uppercase hover:border-zinc-500 transition"
                    data-testid="save-mapping-preset-btn"
                  >
                    Save Mapping Preset
                  </button>
                  <button
                    onClick={handleDryRunWithMapping}
                    className="mb-2 w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-mono text-xs uppercase hover:bg-cyan-500/20 transition"
                    data-testid="dry-run-import-btn"
                  >
                    Dry Run With Mapping
                  </button>
                  <button
                    onClick={handleApplyRemapAndImport}
                    className="px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono text-xs uppercase hover:bg-emerald-500/20 transition"
                    data-testid="apply-remap-import-btn"
                  >
                    Apply Remap & Import
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DataManagement;
