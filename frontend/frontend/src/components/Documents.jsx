import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { FileText, Upload, Search, Download, Trash2, Eye, Loader2 } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getToken = () => localStorage.getItem('eden_token');

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [stats, setStats] = useState({ total: 0, storage: '0 MB', thisMonth: 0, shared: 0 });
  const fileInputRef = useRef(null);

  const documentTypes = ['All', 'Policy Document', 'Inspection Report', 'Photos', 'Estimate', 'Contract', 'Other'];

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/uploads/my-files`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        const docs = Array.isArray(data) ? data : (data.documents || []);
        setDocuments(docs);
        
        const totalSize = docs.reduce((acc, doc) => {
          const sizeMatch = doc.size?.match(/(\d+\.?\d*)\s*(KB|MB|GB)/i);
          if (sizeMatch) {
            const [, num, unit] = sizeMatch;
            const multiplier = unit.toUpperCase() === 'GB' ? 1024 : unit.toUpperCase() === 'MB' ? 1 : 0.001;
            return acc + parseFloat(num) * multiplier;
          }
          return acc;
        }, 0);
        
        setStats({
          total: docs.length,
          storage: totalSize > 1024 ? `${(totalSize / 1024).toFixed(1)} GB` : `${totalSize.toFixed(1)} MB`,
          thisMonth: docs.filter(d => {
            const uploaded = new Date(d.uploaded_at || d.uploadedAt);
            const now = new Date();
            return uploaded.getMonth() === now.getMonth() && uploaded.getFullYear() === now.getFullYear();
          }).length,
          shared: docs.filter(d => d.shared).length
        });
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      toast.error('Failed to load documents');
    }
    setLoading(false);
  };

  const filteredDocs = documents.filter(doc => {
    const name = doc.name || doc.filename || '';
    const type = doc.type || doc.category || 'Other';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || type === filterType;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString();
  };

  const handleUpload = async (e) => {
    const files = e?.target?.files || [];
    if (files.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'Document');
        
        const res = await fetch(`${API_URL}/api/uploads/file`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData
        });
        
        if (res.ok) {
          toast.success(`Uploaded: ${file.name}`);
          fetchDocuments();
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      } catch (err) {
        toast.error(`Upload error: ${err.message}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (docId) => {
    try {
      const res = await fetch(`${API_URL}/api/uploads/file/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        toast.success('Document deleted');
      }
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter">
      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src={NAV_ICONS.documents} alt="Documents" className="w-12 h-12 sm:w-14 sm:h-14 object-contain icon-3d-shadow" />
            <div>
              <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">CLOUD STORAGE</h1>
              <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">Centralized Document Management</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.csv" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="btn-tactical px-4 py-2.5 text-sm flex items-center gap-2" data-testid="upload-files-btn">
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger-children">
        {[
          { label: 'Total Documents', value: stats.total, color: 'blue' },
          { label: 'Storage Used', value: stats.storage, color: 'orange' },
          { label: 'This Month', value: stats.thisMonth, color: 'green' },
          { label: 'Shared Files', value: stats.shared, color: 'purple' },
        ].map((stat) => (
          <div key={stat.label} className="card-tactical p-4 shadow-tactical hover-lift-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl sm:text-3xl font-tactical font-bold text-${stat.color}-400`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="card-tactical p-4 mb-6 shadow-tactical">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-4 h-4" />
            <input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono text-sm"
              data-testid="doc-search-input"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {documentTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
                }`}
                data-testid={`filter-${type.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents List */}
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
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
              <FileText className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-500 font-mono text-sm mb-2">
              {searchTerm || filterType !== 'All' ? 'No documents match your search' : 'No documents uploaded yet'}
            </p>
            <p className="text-zinc-600 text-xs font-mono">Upload documents from claim details pages</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm"
                data-testid={`doc-${doc.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                      <FileText className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-tactical font-bold text-white text-sm truncate">{doc.name || doc.filename}</h4>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-700/50 text-zinc-400">
                          {doc.type || doc.category || 'Document'}
                        </span>
                        {doc.size && <span className="text-xs text-zinc-500 font-mono">{doc.size}</span>}
                        <span className="text-xs text-zinc-600 font-mono">{formatDate(doc.uploaded_at || doc.uploadedAt || doc.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all" data-testid={`view-doc-${doc.id}`}>
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-all" data-testid={`download-doc-${doc.id}`}>
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(doc.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all" data-testid={`delete-doc-${doc.id}`}>
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
