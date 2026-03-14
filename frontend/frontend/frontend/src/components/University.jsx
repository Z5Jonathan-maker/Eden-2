/**
 * University Component - Doctrine & Training Hub
 * Enhanced with: global search, tab badges, progress tracking, engagement stats
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import UniversityHeader from './university/UniversityHeader';
import CoursesTab from './university/CoursesTab';
import ArticlesTab from './university/ArticlesTab';
import VideosTab from './university/VideosTab';
import CertificatesTab from './university/CertificatesTab';
import FirmContentTab from './university/FirmContentTab';
import CreateContentModal from './university/CreateContentModal';
import LibraryTab from './university/LibraryTab';
import AddBookModal from './university/AddBookModal';
import WorkbooksTab from './university/WorkbooksTab';
import {
  BookOpen, FileText, PlayCircle, Award, FolderOpen, Library, Layers,
  Search, X, Target, Clock, CheckCircle2, ShieldCheck, TrendingUp
} from 'lucide-react';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;
const TABS = [
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'videos', label: 'Videos', icon: PlayCircle },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'workbooks', label: 'Workbooks', icon: Layers },
];
const ENGAGEMENT_STATS = [
  { label: 'Courses Completed', value: 12, icon: Target, color: 'orange' },
  { label: 'Study Hours', value: 47, icon: Clock, color: 'blue' },
  { label: 'Quizzes Passed', value: 28, icon: CheckCircle2, color: 'green' },
  { label: 'Certifications', value: 5, icon: ShieldCheck, color: 'purple' },
];
const CLR = {
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  green: { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-400' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' },
};
const DEFAULT_CONTENT = { title: '', description: '', content: '', category: 'custom', doc_type: 'sop', tags: '', is_published: false };
const setDefaults = (setA, setB, setC) => { setA('Your Firm'); setB('Your Firm University'); setC('Your Firm University'); };
const fuzzy = (item, fields, q) => fields.some(f => (item[f] || '').toLowerCase().includes(q));

function University() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [courses, setCourses] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [videoSources, setVideoSources] = useState({ sources: [], playlists: [] });
  const [customContent, setCustomContent] = useState({ courses: [], articles: [], documents: [] });
  const [libraryBooks, setLibraryBooks] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [workbooks, setWorkbooks] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('article');
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [newContent, setNewContent] = useState({ ...DEFAULT_CONTENT });
  const canEdit = user && (user.role === 'admin' || user.role === 'manager');

  const tabCounts = useMemo(() => ({
    courses: courses.length, articles: articles.length,
    videos: (videoSources.sources?.length || 0) + (videoSources.playlists?.length || 0),
    certificates: certificates.length, library: libraryBooks.length,
    workbooks: workbooks.length,
    firm: (customContent.courses?.length || 0) + (customContent.articles?.length || 0) + (customContent.documents?.length || 0),
  }), [courses, articles, videoSources, certificates, libraryBooks, workbooks, customContent]);

  const headerSubtitle = useMemo(() => {
    const p = [];
    if (courses.length) p.push(`${courses.length} courses`);
    if (articles.length) p.push(`${articles.length} articles`);
    if (libraryBooks.length) p.push(`${libraryBooks.length} books`);
    if (workbooks.length) p.push(`${workbooks.length} workbooks`);
    return p.length ? p.join(' \u2022 ') : 'No content yet';
  }, [courses, articles, libraryBooks, workbooks]);

  const progressData = useMemo(() => {
    if (!stats || !stats.total_courses) return null;
    const { total_courses: total, completed_courses: completed = 0, in_progress: ip = 0 } = stats;
    return { total, completed, inProgress: ip, pct: Math.round((completed / total) * 100) };
  }, [stats]);

  const q = globalSearch.toLowerCase();
  const filteredCourses = useMemo(() => q ? courses.filter(c => fuzzy(c, ['title', 'description', 'category'], q)) : courses, [courses, q]);
  const filteredArticles = useMemo(() => q ? articles.filter(a => fuzzy(a, ['title', 'description', 'content'], q)) : articles, [articles, q]);
  const filteredBooks = useMemo(() => q ? libraryBooks.filter(b => fuzzy(b, ['title', 'author'], q)) : libraryBooks, [libraryBooks, q]);
  const filteredWorkbooks = useMemo(() => q ? workbooks.filter(w => fuzzy(w, ['title', 'description'], q)) : workbooks, [workbooks, q]);

  const fetchCompanySettings = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/company');
      if (res.ok) {
        const name = res.data.company_name || 'Your Firm';
        const uniName = res.data.university_name || `${name} University`;
        setCompanyName(name); setUniversityName(uniName); setEditedName(uniName);
      } else setDefaults(setCompanyName, setUniversityName, setEditedName);
    } catch { setDefaults(setCompanyName, setUniversityName, setEditedName); }
  }, []);

  const saveUniversityName = async () => {
    try {
      const res = await apiPut('/api/settings/company', { university_name: editedName });
      if (res.ok) { setUniversityName(editedName); setIsEditingName(false); }
      else toast.error('Failed to save university name');
    } catch { toast.error('Failed to save university name'); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, ar, sr, ce] = await Promise.all([
        apiGet('/api/university/courses'), apiGet('/api/university/articles'),
        apiGet('/api/university/stats'), apiGet('/api/university/certificates')
      ]);
      setCourses(cr.ok ? (cr.data || []) : []);
      setArticles(ar.ok ? (ar.data || []) : []);
      setStats(sr.ok ? sr.data : null);
      setCertificates(ce.ok ? (ce.data || []) : []);
    } catch (err) { console.error('Failed to fetch data:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchVideoSources = async () => { try { const r = await apiGet('/api/university/video-sources'); if (r.ok) setVideoSources(r.data); } catch {} };
  const fetchCustomContent = useCallback(async () => { try { const r = await apiGet('/api/university/custom/all'); if (r.ok) setCustomContent(r.data); } catch (e) { console.error('Failed to fetch custom content:', e); } }, []);
  const fetchLibraryBooks = useCallback(async () => { setLibraryLoading(true); try { const r = await apiGet('/api/university/library/books'); if (r.ok) setLibraryBooks(r.data || []); } catch (e) { console.error('Failed to fetch library books:', e); } finally { setLibraryLoading(false); } }, []);
  const fetchWorkbooks = useCallback(async () => { try { const r = await apiGet('/api/university/workbooks'); if (r.ok) setWorkbooks(r.data || []); } catch (e) { console.error('Failed to fetch workbooks:', e); } }, []);

  useEffect(() => { fetchCompanySettings(); fetchData(); fetchCustomContent(); fetchWorkbooks(); }, [fetchCompanySettings, fetchData, fetchCustomContent, fetchWorkbooks]);

  const handleCreateContent = async () => {
    setSaving(true);
    const endpoints = { article: '/api/university/custom/articles', document: '/api/university/custom/documents', course: '/api/university/custom/courses' };
    const tags = newContent.tags ? newContent.tags.split(',').map(t => t.trim()) : [];
    const bodies = {
      article: { title: newContent.title, description: newContent.description, content: newContent.content, category: newContent.category || 'custom', tags, is_published: newContent.is_published },
      document: { title: newContent.title, description: newContent.description, content: newContent.content, doc_type: newContent.doc_type, tags, is_published: newContent.is_published },
      course: { title: newContent.title, description: newContent.description, category: newContent.category || 'custom', lessons: [], is_published: newContent.is_published },
    };
    try {
      const res = await apiPost(endpoints[createType], bodies[createType]);
      if (!res.ok) throw new Error('Failed to create');
      await Promise.all(attachedFiles.map(file => {
        const fd = new FormData(); fd.append('content_id', res.data.id); fd.append('content_type', createType);
        return apiPut(`/api/uploads/file/${file.id}/attach`, fd);
      }));
      resetCreateModal(); fetchCustomContent(); fetchData();
    } catch (err) { toast.error('Error creating content: ' + err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteContent = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    const ep = { article: `/api/university/custom/articles/${id}`, document: `/api/university/custom/documents/${id}`, course: `/api/university/custom/courses/${id}` };
    try { const r = await apiDelete(ep[type]); if (!r.ok) throw new Error('Failed to delete'); fetchCustomContent(); fetchData(); }
    catch (err) { toast.error('Error deleting: ' + err.message); }
  };

  const togglePublish = async (type, item) => {
    const ep = { article: `/api/university/custom/articles/${item.id}`, document: `/api/university/custom/documents/${item.id}`, course: `/api/university/custom/courses/${item.id}` };
    try { const r = await apiPut(ep[type], { ...item, is_published: !item.is_published }); if (!r.ok) throw new Error('Failed to update'); fetchCustomContent(); fetchData(); }
    catch (err) { toast.error('Error updating: ' + err.message); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('File too large. Maximum size is 50MB.'); return; }
    setUploadingFile(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await apiPost('/api/uploads/file', fd);
      if (!r.ok) throw new Error('Upload failed');
      setAttachedFiles(prev => [...prev, { id: r.data.id, filename: r.data.original_name, size: r.data.size, url: API_URL + r.data.url }]);
    } catch (err) { toast.error('Error uploading file: ' + err.message); }
    finally { setUploadingFile(false); e.target.value = ''; }
  };

  const removeAttachedFile = async (index) => {
    const file = attachedFiles[index];
    try { const r = await apiDelete(`/api/uploads/file/${file.id}`); if (r.ok) setAttachedFiles(prev => prev.filter((_, i) => i !== index)); }
    catch (err) { console.error('Error removing file:', err); }
  };

  const resetCreateModal = () => { setShowCreateModal(false); setNewContent({ ...DEFAULT_CONTENT }); setAttachedFiles([]); };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'videos') fetchVideoSources();
    if (tabId === 'firm') fetchCustomContent();
    if (tabId === 'library') fetchLibraryBooks();
    if (tabId === 'workbooks') fetchWorkbooks();
  };

  if (loading) {
    return (
      <div className="p-8 bg-tactical-animated min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading University...</p>
        </div>
      </div>
    );
  }

  const allTabs = canEdit ? [...TABS, { id: 'firm', label: 'Firm Content', icon: FolderOpen }] : TABS;

  return (
    <div className="p-4 sm:p-8 bg-tactical-animated min-h-screen page-enter">
      <UniversityHeader universityName={universityName} isEditingName={isEditingName} editedName={editedName}
        setEditedName={setEditedName} setIsEditingName={setIsEditingName} onSave={saveUniversityName} canEdit={canEdit} />

      {/* Subtitle divider with content stats */}
      <div className="flex items-center gap-3 mb-6 -mt-4">
        <div className="h-px flex-1 bg-gradient-to-r from-orange-500/40 via-orange-500/10 to-transparent" />
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 whitespace-nowrap">{headerSubtitle}</span>
        <div className="h-px flex-1 bg-gradient-to-l from-orange-500/40 via-orange-500/10 to-transparent" />
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ENGAGEMENT_STATS.map((s) => {
          const Icon = s.icon; const c = CLR[s.color];
          return (
            <div key={s.label} className={`group bg-[#1a1a1a] border ${c.border} rounded-xl p-4 hover:border-orange-500/30 transition-all duration-300 cursor-default`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-[10px] sm:text-xs font-mono uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">{s.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${c.bg} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${c.text}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      {progressData && (
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Course Progress</span>
            </div>
            <span className="text-sm font-mono font-bold text-orange-400">{progressData.pct}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressData.pct}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">{progressData.completed}/{progressData.total} completed</span>
            {progressData.inProgress > 0 && <span className="text-[10px] font-mono text-zinc-500 uppercase">{progressData.inProgress} in progress</span>}
          </div>
        </div>
      )}

      {/* Global Search */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="w-4 h-4 text-zinc-500" /></div>
        <input type="text" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search across all courses, articles, books, workbooks..."
          className="w-full pl-11 pr-10 py-3 bg-[#1a1a1a] border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all duration-200" />
        {globalSearch && (
          <button onClick={() => setGlobalSearch('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs with Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {allTabs.map((tab) => {
          const Icon = tab.icon; const isActive = activeTab === tab.id; const count = tabCounts[tab.id] || 0;
          return (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-mono uppercase tracking-wider transition-all duration-200 ${
                isActive ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30 hover:border-orange-500/30'}`}>
              <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${isActive ? 'bg-[#1a1a1a]/20 text-white' : 'bg-zinc-700 text-zinc-300'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'courses' && <CoursesTab courses={filteredCourses} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />}
      {activeTab === 'articles' && <ArticlesTab articles={filteredArticles} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
      {activeTab === 'videos' && <VideosTab videoSources={videoSources} />}
      {activeTab === 'certificates' && <CertificatesTab certificates={certificates} />}
      {activeTab === 'firm' && <FirmContentTab customContent={customContent} onCreateClick={() => setShowCreateModal(true)} onTogglePublish={togglePublish} onDelete={handleDeleteContent} />}
      {activeTab === 'library' && <LibraryTab books={filteredBooks} loading={libraryLoading} onAddClick={() => setShowAddBookModal(true)} canEdit={canEdit} onRefresh={fetchLibraryBooks} />}
      {activeTab === 'workbooks' && <WorkbooksTab workbooks={filteredWorkbooks} canEdit={canEdit} onRefresh={fetchWorkbooks} />}

      <AddBookModal show={showAddBookModal} onClose={() => setShowAddBookModal(false)} onBookAdded={fetchLibraryBooks} />
      <CreateContentModal show={showCreateModal} onClose={resetCreateModal} createType={createType} setCreateType={setCreateType}
        newContent={newContent} setNewContent={setNewContent} attachedFiles={attachedFiles} setAttachedFiles={setAttachedFiles}
        saving={saving} uploadingFile={uploadingFile} onSave={handleCreateContent} onFileUpload={handleFileUpload} onRemoveFile={removeAttachedFile} />
    </div>
  );
}

export default University;
