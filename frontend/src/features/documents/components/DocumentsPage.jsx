import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import ClaimSelector from './documents/ClaimSelector';
import ApiService from '../services/ApiService';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;
const getToken = () => localStorage.getItem('eden_token');

const Documents = () => {
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [stats, setStats] = useState({ total: 0, storage: '0 MB', thisMonth: 0, shared: 0 });
  const [aiExtractionByName, setAiExtractionByName] = useState({});
  const [extractingByName, setExtractingByName] = useState({});
  const [applyingExtractionByDocId, setApplyingExtractionByDocId] = useState({});
  const fileInputRef = useRef(null);
  const statColorClass = {
    blue: 'text-blue-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
  };

  const documentTypes = [
    'All',
    'Policy Document',
    'Inspection Report',
    'Photos',
    'Estimate',
    'Contract',
    'Other',
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
  };

  const inferType = useCallback((doc) => {
    const explicit = doc.type || doc.category || doc.document_type;
    if (explicit) return explicit;
    const name = (doc.name || doc.filename || '').toLowerCase();
    if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) return 'Photos';
    if (name.match(/\.(xls|xlsx|csv)$/)) return 'Estimate';
    if (name.match(/\.(pdf|doc|docx)$/)) return 'Policy Document';
    return 'Other';
  }, []);

  const getDocId = useCallback((doc) => doc.id || doc.file_id || doc._id || doc.upload_id, []);

  const getDocUrl = useCallback(
    (doc) => doc.url || doc.file_url || doc.download_url || doc.public_url || doc.s3_url || '',
    []
  );
  const getExtractionKey = (doc) => String(doc?.id || doc?.name || '');
  const getUploadExtractionKey = (file) =>
    `${file?.name || 'file'}:${file?.size || 0}:${file?.lastModified || 0}`;
  const getExtractionResultForDoc = (doc) =>
    aiExtractionByName[getExtractionKey(doc)] || aiExtractionByName[doc?.name || ''];
  const isDocExtracting = (doc) =>
    Boolean(extractingByName[getExtractionKey(doc)] || extractingByName[doc?.name || '']);

  const normalizeDocs = useCallback(
    (rows) =>
      (rows || []).map((doc) => ({
        ...doc,
        id: getDocId(doc),
        type: inferType(doc),
        name: doc.name || doc.filename || 'Untitled',
        uploaded_at: doc.uploaded_at || doc.uploadedAt || doc.created_at || doc.createdAt,
        size: doc.size || doc.file_size || '',
        url: getDocUrl(doc),
      })),
    [getDocId, inferType, getDocUrl]
  );

  const recalcStats = (docs) => {
    const totalSizeMb = docs.reduce((acc, doc) => {
      if (typeof doc.size === 'number') return acc + doc.size / (1024 * 1024);
      const sizeMatch = String(doc.size || '').match(/(\d+\.?\d*)\s*(KB|MB|GB)/i);
      if (!sizeMatch) return acc;
      const [, num, unit] = sizeMatch;
      const multiplier =
        unit.toUpperCase() === 'GB' ? 1024 : unit.toUpperCase() === 'MB' ? 1 : 0.001;
      return acc + parseFloat(num) * multiplier;
    }, 0);

    setStats({
      total: docs.length,
      storage:
        totalSizeMb > 1024
          ? `${(totalSizeMb / 1024).toFixed(1)} GB`
          : `${totalSizeMb.toFixed(1)} MB`,
      thisMonth: docs.filter((d) => {
        const uploaded = new Date(d.uploaded_at);
        const now = new Date();
        return (
          uploaded.getMonth() === now.getMonth() && uploaded.getFullYear() === now.getFullYear()
        );
      }).length,
      shared: docs.filter((d) => d.shared).length,
    });
  };

  const fetchClaimDocuments = useCallback(
    async (claimId) => {
      if (!claimId) {
        setDocuments([]);
        setStats({ total: 0, storage: '0 MB', thisMonth: 0, shared: 0 });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        const endpoints = [
          `${API_URL}/api/claims/${claimId}/files`,
          `${API_URL}/api/uploads/my-files?claim_id=${claimId}`,
        ];

        let docs = [];
        for (const endpoint of endpoints) {
          const res = await fetch(endpoint, { headers });
          if (!res.ok) continue;
          const data = await res.json();
          const rows = Array.isArray(data) ? data : data.files || data.documents || [];
          docs = normalizeDocs(rows);
          break;
        }

        setDocuments(docs);
        recalcStats(docs);
      } catch (err) {
        console.error('Failed to fetch claim documents:', err);
        toast.error('Failed to load claim documents');
        setDocuments([]);
        recalcStats([]);
      } finally {
        setLoading(false);
      }
    },
    [normalizeDocs]
  );

  useEffect(() => {
    fetchClaimDocuments(selectedClaimId);
  }, [selectedClaimId, fetchClaimDocuments]);

  const handleUploadClick = () => {
    if (!selectedClaimId) {
      toast.info('Select a claim to upload files.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleUpload = async (e) => {
    const files = Array.from(e?.target?.files || []);
    if (!files.length) return;
    if (!selectedClaimId) {
      toast.info('Select a claim to upload files.');
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'Document');

        let uploaded = false;
        const endpoints = [
          `${API_URL}/api/claims/${selectedClaimId}/files/upload`,
          `${API_URL}/api/uploads/file`,
        ];

        for (const endpoint of endpoints) {
          const payload = new FormData();
          payload.append('file', file);
          payload.append('category', 'Document');
          if (endpoint.includes('/api/uploads/file')) payload.append('claim_id', selectedClaimId);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: payload,
          });
          if (res.ok) {
            uploaded = true;
            break;
          }
        }

        if (!uploaded) throw new Error(`Upload failed: ${file.name}`);

        // Optional AI extraction pass (additive, does not block upload success UX)
        const extractionKey = getUploadExtractionKey(file);
        setExtractingByName((prev) => ({ ...prev, [extractionKey]: true }));
        try {
          const extractionPayload = new FormData();
          extractionPayload.append('file', file);
          const extractRes = await fetch(
            `${API_URL}/api/ai/documents/extract?claim_id=${selectedClaimId}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${getToken()}` },
              body: extractionPayload,
            }
          );
          if (extractRes.ok) {
            const extractData = await extractRes.json();
            setAiExtractionByName((prev) => ({
              ...prev,
              [extractionKey]: extractData,
              [file.name]: extractData,
            }));
          }
        } catch (extractErr) {
          // Silent failure: upload still succeeds and existing workflow remains intact.
          console.warn('AI extraction skipped for', file.name, extractErr);
        } finally {
          setExtractingByName((prev) => ({ ...prev, [extractionKey]: false }));
        }
      }

      toast.success('Files uploaded');
      await fetchClaimDocuments(selectedClaimId);
    } catch (err) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc) => {
    if (!selectedClaimId) return;
    const docId = doc.id;
    if (!docId) return;

    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const endpoints = [
        `${API_URL}/api/claims/${selectedClaimId}/files/${docId}`,
        `${API_URL}/api/uploads/file/${docId}`,
      ];

      let deleted = false;
      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, { method: 'DELETE', headers });
        if (res.ok) {
          deleted = true;
          break;
        }
      }

      if (!deleted) throw new Error('Delete failed');
      const next = documents.filter((d) => d.id !== docId);
      setDocuments(next);
      recalcStats(next);
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  const openPreview = (doc) => {
    if (doc.url) {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.info('Preview URL unavailable for this file');
  };

  const runAiExtractForDocument = async (doc) => {
    const extractionKey = getExtractionKey(doc);
    if (!doc?.url) {
      toast.info('No document URL available for AI extract');
      return;
    }

    try {
      setExtractingByName((prev) => ({ ...prev, [extractionKey]: true }));
      const downloadRes = await fetch(doc.url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!downloadRes.ok) {
        throw new Error('Unable to fetch file for extraction');
      }

      const blob = await downloadRes.blob();
      const fileName = doc.name || 'document';
      const contentType = blob.type || 'application/octet-stream';
      const file = new File([blob], fileName, { type: contentType });

      const extractionPayload = new FormData();
      extractionPayload.append('file', file);
      const extractRes = await fetch(
        `${API_URL}/api/ai/documents/extract?claim_id=${selectedClaimId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: extractionPayload,
        }
      );
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.detail || 'AI extraction failed');
      }

      const extractData = await extractRes.json();
      setAiExtractionByName((prev) => ({ ...prev, [extractionKey]: extractData }));
      toast.success(`AI extract completed for ${fileName}`);
    } catch (err) {
      toast.error(err?.message || 'AI extraction failed');
    } finally {
      setExtractingByName((prev) => ({ ...prev, [extractionKey]: false }));
    }
  };

  const buildClaimUpdatesFromExtraction = (extractResult) => {
    if (!extractResult || typeof extractResult !== 'object') return {};
    const fields = extractResult.extracted_fields || {};
    const allowlist = [
      'client_name',
      'claim_number',
      'policy_number',
      'property_address',
      'date_of_loss',
      'insurance_company',
      'client_email',
      'client_phone',
    ];

    return allowlist.reduce((acc, key) => {
      const value = fields[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        acc[key] = value;
      }
      return acc;
    }, {});
  };

  const applyExtractionToClaim = async (doc) => {
    if (!selectedClaimId) {
      toast.info('Select a claim first');
      return;
    }
    const extraction = getExtractionResultForDoc(doc);
    if (!extraction) {
      toast.info('Run AI extract first');
      return;
    }
    const updates = buildClaimUpdatesFromExtraction(extraction);
    const fieldNames = Object.keys(updates);
    if (!fieldNames.length) {
      toast.info('No mappable claim fields found in extraction');
      return;
    }

    const confirmed = window.confirm(
      `Apply ${fieldNames.length} extracted field${fieldNames.length > 1 ? 's' : ''} to claim?\n\n${fieldNames.join(', ')}`
    );
    if (!confirmed) return;

    const applyKey = String(doc?.id || doc?.name || '');
    try {
      setApplyingExtractionByDocId((prev) => ({ ...prev, [applyKey]: true }));
      await ApiService.updateClaim(selectedClaimId, updates);
      try {
        await ApiService.addClaimNote(
          selectedClaimId,
          `AI extraction applied from document "${doc?.name || 'document'}". Updated fields: ${fieldNames.join(', ')}.`
        );
      } catch (noteErr) {
        // Non-blocking: claim update already succeeded.
      }
      toast.success(
        `Applied ${fieldNames.length} field${fieldNames.length > 1 ? 's' : ''} to claim`
      );
    } catch (err) {
      toast.error(err?.message || 'Failed to apply extraction');
    } finally {
      setApplyingExtractionByDocId((prev) => ({ ...prev, [applyKey]: false }));
    }
  };

  const downloadDoc = (doc) => {
    if (!doc.url) {
      toast.info('Download URL unavailable for this file');
      return;
    }
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'All' || doc.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [documents, filterType, searchTerm]);

  const extractionInsights = useMemo(() => {
    const extractedRows = Object.values(aiExtractionByName).filter(Boolean);
    if (!extractedRows.length) return null;

    const avgConfidence =
      extractedRows.reduce((sum, row) => sum + (Number(row.confidence) || 0), 0) /
      extractedRows.length;
    const docTypeCounts = extractedRows.reduce((acc, row) => {
      const type = row.doc_type || 'Other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const missingCounts = extractedRows.reduce((acc, row) => {
      const missing = Array.isArray(row.missing_fields) ? row.missing_fields : [];
      missing.forEach((field) => {
        acc[field] = (acc[field] || 0) + 1;
      });
      return acc;
    }, {});

    const topMissing = Object.entries(missingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      extracted: extractedRows.length,
      avgConfidence: Math.round(avgConfidence * 100),
      topTypes: Object.entries(docTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
      topMissing,
    };
  }, [aiExtractionByName]);

  const fileIcon = (doc) => {
    const type = String(doc.type || '').toLowerCase();
    if (type.includes('photo') || type.includes('image'))
      return <FileImage className="w-5 h-5 text-cyan-400" />;
    if (type.includes('estimate') || type.includes('spreadsheet'))
      return <FileSpreadsheet className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-orange-400" />;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter">
      <div className="mb-6 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={NAV_ICONS.documents}
              alt="Documents"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain icon-3d-shadow"
            />
            <div>
              <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
                CLOUD STORAGE
              </h1>
              <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">
                Hybrid Claim Document Hub
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv"
            onChange={handleUpload}
            className="hidden"
          />

          <button
            onClick={handleUploadClick}
            disabled={!selectedClaimId || uploading}
            title={!selectedClaimId ? 'Select a claim to upload files.' : ''}
            className="btn-tactical px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
            data-testid="upload-files-btn"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload Files
          </button>
        </div>
      </div>

      <div className="card-tactical p-4 mb-4 shadow-tactical">
        <ClaimSelector selectedClaimId={selectedClaimId} onSelect={setSelectedClaimId} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger-children">
        {[
          { label: 'Total Documents', value: stats.total, color: 'blue' },
          { label: 'Storage Used', value: stats.storage, color: 'orange' },
          { label: 'This Month', value: stats.thisMonth, color: 'green' },
          { label: 'Shared Files', value: stats.shared, color: 'purple' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card-tactical p-4 shadow-tactical hover-lift-sm"
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p
              className={`text-2xl sm:text-3xl font-tactical font-bold ${statColorClass[stat.color] || 'text-zinc-200'}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="card-tactical p-4 mb-6 shadow-tactical">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input
              placeholder="Search documents..."
              value={searchTerm}
              disabled={!selectedClaimId}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono text-sm disabled:opacity-50"
              data-testid="doc-search-input"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {documentTypes.map((type) => (
              <button
                key={type}
                disabled={!selectedClaimId}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
                } disabled:opacity-45 disabled:cursor-not-allowed`}
                data-testid={`filter-${type.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-tactical p-4 sm:p-5 shadow-tactical">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            {loading ? 'Loading...' : `${filteredDocs.length} Documents`}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner-tactical w-10 h-10" />
          </div>
        ) : !selectedClaimId ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
              <FileText className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-mono text-sm mb-2">
              Select a claim to view or upload documents.
            </p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
              <FileText className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-mono text-sm mb-2">
              {searchTerm || filterType !== 'All'
                ? 'No documents match your search'
                : 'This claim has no documents yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {extractionInsights && (
              <div className="mb-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase font-mono text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Extraction Insights
                  </p>
                  <p className="text-[10px] font-mono text-zinc-400">
                    {extractionInsights.extracted} files | avg {extractionInsights.avgConfidence}%
                  </p>
                </div>
                <div className="mt-2 text-[11px] text-zinc-300 space-y-1">
                  <p>
                    Top types:{' '}
                    {extractionInsights.topTypes
                      .map(([type, count]) => `${type} (${count})`)
                      .join(', ')}
                  </p>
                  {extractionInsights.topMissing.length > 0 && (
                    <p className="text-amber-300">
                      Recurring missing fields:{' '}
                      {extractionInsights.topMissing
                        .map(([field, count]) => `${field} (${count})`)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm"
                data-testid={`doc-${doc.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-700/40 flex-shrink-0">
                      {fileIcon(doc)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-tactical font-bold text-white text-sm truncate">
                        {doc.name}
                      </h4>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-700/50 text-zinc-400">
                          {doc.type || 'Document'}
                        </span>
                        {doc.size && (
                          <span className="text-xs text-zinc-500 font-mono">{doc.size}</span>
                        )}
                        <span className="text-xs text-zinc-600 font-mono">
                          {formatDate(doc.uploaded_at)}
                        </span>
                      </div>
                      {(isDocExtracting(doc) || getExtractionResultForDoc(doc)) && (
                        <div className="mt-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
                          {isDocExtracting(doc) ? (
                            <div className="flex items-center gap-2 text-[11px] text-cyan-300 font-mono uppercase">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              AI Extracting...
                            </div>
                          ) : (
                            <div className="text-[11px] space-y-1">
                              <div className="flex items-center gap-1 text-cyan-300 font-mono uppercase">
                                <Sparkles className="w-3 h-3" />
                                AI Extract
                              </div>
                              <div className="text-zinc-300">
                                Type: {getExtractionResultForDoc(doc)?.doc_type || 'Unknown'} |
                                Confidence:{' '}
                                {Math.round(
                                  (getExtractionResultForDoc(doc)?.confidence || 0) * 100
                                )}
                                %
                              </div>
                              {Array.isArray(getExtractionResultForDoc(doc)?.missing_fields) &&
                                getExtractionResultForDoc(doc).missing_fields.length > 0 && (
                                  <div className="text-amber-300">
                                    Missing:{' '}
                                    {getExtractionResultForDoc(doc)
                                      .missing_fields.slice(0, 3)
                                      .join(', ')}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      onClick={() => openPreview(doc)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      data-testid={`view-doc-${doc.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadDoc(doc)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-all"
                      data-testid={`download-doc-${doc.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => runAiExtractForDocument(doc)}
                      disabled={isDocExtracting(doc)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Run AI extract"
                      data-testid={`ai-extract-doc-${doc.id}`}
                    >
                      {isDocExtracting(doc) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => applyExtractionToClaim(doc)}
                      disabled={
                        !getExtractionResultForDoc(doc) ||
                        applyingExtractionByDocId[String(doc?.id || doc?.name || '')]
                      }
                      className="p-2 rounded-lg text-zinc-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Apply extraction to claim"
                      data-testid={`apply-extract-doc-${doc.id}`}
                    >
                      {applyingExtractionByDocId[String(doc?.id || doc?.name || '')] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      data-testid={`delete-doc-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
