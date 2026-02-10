import React from 'react';
import { Download, Upload, FileSpreadsheet, FileJson, Database } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function DataManagement() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const fileInputRef = React.useRef(null);

  React.useEffect(function() { fetchStats(); }, []);

  function getToken() { return localStorage.getItem('eden_token'); }

  function fetchStats() {
    setLoading(true);
    fetch(API_URL + '/api/data/stats', { headers: { 'Authorization': 'Bearer ' + getToken() } })
      .then(function(res) { return res.json(); })
      .then(function(data) { setStats(data); setLoading(false); })
      .catch(function() { setLoading(false); });
  }

  function handleExportCSV() {
    fetch(API_URL + '/api/data/export/claims', { headers: { 'Authorization': 'Bearer ' + getToken() } })
      .then(function(res) { return res.blob(); })
      .then(function(blob) { var url = window.URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'claims_export.csv'; a.click(); });
  }

  function handleExportJSON() {
    fetch(API_URL + '/api/data/export/claims/json', { headers: { 'Authorization': 'Bearer ' + getToken() } })
      .then(function(res) { return res.blob(); })
      .then(function(blob) { var url = window.URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'claims_export.json'; a.click(); });
  }

  function handleDownloadTemplate() {
    fetch(API_URL + '/api/data/template/claims', { headers: { 'Authorization': 'Bearer ' + getToken() } })
      .then(function(res) { return res.blob(); })
      .then(function(blob) { var url = window.URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'claims_template.csv'; a.click(); });
  }

  function handleImport(e) {
    var file = e.target.files[0];
    if (!file) return;
    var formData = new FormData();
    formData.append('file', file);
    fetch(API_URL + '/api/data/import/claims', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() }, body: formData })
      .then(function(res) { return res.json(); })
      .then(function(data) { toast.success('Imported: ' + data.imported + ', Skipped: ' + data.skipped); fetchStats(); })
      .catch(function() { toast.error('Import failed'); });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter" data-testid="data-management-page">
      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <img src={NAV_ICONS.data_ops} alt="Data Ops" className="w-12 h-12 sm:w-14 sm:h-14 object-contain icon-3d-shadow" />
          <div>
            <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">DATA OPS</h1>
            <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">Import & Export Claims Intelligence</p>
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="card-tactical p-4 sm:p-5 mb-6 shadow-tactical" data-testid="db-stats-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Database Stats</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="spinner-tactical w-8 h-8" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
            <div className="p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover-lift-sm" data-testid="stat-claims">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Claims</p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-blue-400">{stats.total_claims}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover-lift-sm" data-testid="stat-users">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Users</p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-green-400">{stats.total_users}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover-lift-sm" data-testid="stat-notes">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-purple-400">{stats.total_notes}</p>
            </div>
            <div className="p-3 sm:p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover-lift-sm" data-testid="stat-notifications">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Notifications</p>
              <p className="text-2xl sm:text-3xl font-tactical font-bold text-orange-400">{stats.total_notifications}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Export */}
      <div className="card-tactical p-4 sm:p-5 mb-6 shadow-tactical" data-testid="export-card">
        <div className="mb-4">
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Export</h3>
          <p className="text-zinc-500 font-mono text-xs mt-1">Download claims data</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportCSV} className="px-4 py-2.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-sm uppercase flex items-center gap-2 hover:bg-green-500/20 hover:border-green-500/50 transition-all btn-press-effect" data-testid="export-csv-btn">
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={handleExportJSON} className="px-4 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono text-sm uppercase flex items-center gap-2 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all btn-press-effect" data-testid="export-json-btn">
            <FileJson className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card-tactical p-4 sm:p-5 shadow-tactical" data-testid="import-card">
        <div className="mb-4">
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Import</h3>
          <p className="text-zinc-500 font-mono text-xs mt-1">Upload claims from CSV</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleDownloadTemplate} className="px-4 py-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 font-mono text-sm uppercase flex items-center gap-2 hover:border-orange-500/30 hover:text-orange-400 transition-all btn-press-effect" data-testid="download-template-btn">
            <Download className="w-4 h-4" />
            Download Template
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={function() { fileInputRef.current.click(); }} className="btn-tactical px-4 py-2.5 text-sm flex items-center gap-2" data-testid="import-csv-btn">
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataManagement;
