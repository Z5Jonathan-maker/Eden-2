/**
 * University Component - Main Container
 * Internal training, standards, and doctrine platform
 * 
 * Refactored to use modular components from ./university/
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import UniversityHeader from './university/UniversityHeader';
import StatsBanner from './university/StatsBanner';
import TabNavigation from './university/TabNavigation';
import CoursesTab from './university/CoursesTab';
import ArticlesTab from './university/ArticlesTab';
import VideosTab from './university/VideosTab';
import CertificatesTab from './university/CertificatesTab';
import FirmContentTab from './university/FirmContentTab';
import CreateContentModal from './university/CreateContentModal';
import LibraryTab from './university/LibraryTab';
import AddBookModal from './university/AddBookModal';
import WorkbooksTab from './university/WorkbooksTab';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

function University() {
  const { user } = useAuth();
  
  // UI State
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Data State
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
  
  // University Name State
  const [companyName, setCompanyName] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('article');
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [newContent, setNewContent] = useState({
    title: '',
    description: '',
    content: '',
    category: 'custom',
    doc_type: 'sop',
    tags: '',
    is_published: false
  });

  const canEdit = user && (user.role === 'admin' || user.role === 'manager');

  // API Functions
  const fetchCompanySettings = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/company');
      if (res.ok) {
        const name = res.data.company_name || 'Your Firm';
        const uniName = res.data.university_name || `${name} University`;
        setCompanyName(name);
        setUniversityName(uniName);
        setEditedName(uniName);
      } else {
        setCompanyName('Your Firm');
        setUniversityName('Your Firm University');
        setEditedName('Your Firm University');
      }
    } catch {
      setCompanyName('Your Firm');
      setUniversityName('Your Firm University');
      setEditedName('Your Firm University');
    }
  }, []);

  const saveUniversityName = async () => {
    try {
      const res = await apiPut('/api/settings/company', { university_name: editedName });
      if (res.ok) {
        setUniversityName(editedName);
        setIsEditingName(false);
      } else {
        toast.error('Failed to save university name');
      }
    } catch {
      alert('Failed to save university name');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [coursesRes, articlesRes, statsRes, certsRes] = await Promise.all([
        apiGet('/api/university/courses'),
        apiGet('/api/university/articles'),
        apiGet('/api/university/stats'),
        apiGet('/api/university/certificates')
      ]);

      setCourses(coursesRes.ok ? (coursesRes.data || []) : []);
      setArticles(articlesRes.ok ? (articlesRes.data || []) : []);
      setStats(statsRes.ok ? statsRes.data : null);
      setCertificates(certsRes.ok ? (certsRes.data || []) : []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVideoSources = async () => {
    try {
      const res = await apiGet('/api/university/video-sources');
      if (res.ok) setVideoSources(res.data);
    } catch {
      // Silently fail
    }
  };

  const fetchCustomContent = useCallback(async () => {
    try {
      const res = await apiGet('/api/university/custom/all');
      if (res.ok) setCustomContent(res.data);
    } catch (err) {
      console.error('Failed to fetch custom content:', err);
    }
  }, []);

  const fetchLibraryBooks = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await apiGet('/api/university/library/books');
      if (res.ok) setLibraryBooks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch library books:', err);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const fetchWorkbooks = useCallback(async () => {
    try {
      const res = await apiGet('/api/university/workbooks');
      if (res.ok) setWorkbooks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch workbooks:', err);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchCompanySettings();
    fetchData();
    fetchCustomContent();
  }, [fetchCompanySettings, fetchData, fetchCustomContent]);

  // Content Management Functions
  const handleCreateContent = async () => {
    setSaving(true);
    let endpoint = '';
    let body = {};

    if (createType === 'article') {
      endpoint = '/api/university/custom/articles';
      body = {
        title: newContent.title,
        description: newContent.description,
        content: newContent.content,
        category: newContent.category || 'custom',
        tags: newContent.tags ? newContent.tags.split(',').map(t => t.trim()) : [],
        is_published: newContent.is_published
      };
    } else if (createType === 'document') {
      endpoint = '/api/university/custom/documents';
      body = {
        title: newContent.title,
        description: newContent.description,
        content: newContent.content,
        doc_type: newContent.doc_type,
        tags: newContent.tags ? newContent.tags.split(',').map(t => t.trim()) : [],
        is_published: newContent.is_published
      };
    } else if (createType === 'course') {
      endpoint = '/api/university/custom/courses';
      body = {
        title: newContent.title,
        description: newContent.description,
        category: newContent.category || 'custom',
        lessons: [],
        is_published: newContent.is_published
      };
    }

    try {
      const res = await apiPost(endpoint, body);

      if (!res.ok) throw new Error('Failed to create');

      // Attach files to the created content
      await Promise.all(attachedFiles.map(file => {
        const formData = new FormData();
        formData.append('content_id', res.data.id);
        formData.append('content_type', createType);
        return apiPut(`/api/uploads/file/${file.id}/attach`, formData);
      }));

      resetCreateModal();
      fetchCustomContent();
      fetchData();
    } catch (err) {
      toast.error('Error creating content: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContent = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;

    const endpoints = {
      article: `/api/university/custom/articles/${id}`,
      document: `/api/university/custom/documents/${id}`,
      course: `/api/university/custom/courses/${id}`
    };

    try {
      const res = await apiDelete(endpoints[type]);
      if (!res.ok) throw new Error('Failed to delete');
      fetchCustomContent();
      fetchData();
    } catch (err) {
      toast.error('Error deleting: ' + err.message);
    }
  };

  const togglePublish = async (type, item) => {
    const endpoints = {
      article: `/api/university/custom/articles/${item.id}`,
      document: `/api/university/custom/documents/${item.id}`,
      course: `/api/university/custom/courses/${item.id}`
    };

    try {
      const res = await apiPut(endpoints[type], { ...item, is_published: !item.is_published });
      if (!res.ok) throw new Error('Failed to update');
      fetchCustomContent();
      fetchData();
    } catch (err) {
      toast.error('Error updating: ' + err.message);
    }
  };

  // File Upload Handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 50MB.');
      return;
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiPost('/api/uploads/file', formData);

      if (!res.ok) throw new Error('Upload failed');

      setAttachedFiles(prev => [...prev, {
        id: res.data.id,
        filename: res.data.original_name,
        size: res.data.size,
        url: API_URL + res.data.url
      }]);
    } catch (err) {
      toast.error('Error uploading file: ' + err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const removeAttachedFile = async (index) => {
    const file = attachedFiles[index];
    try {
      const res = await apiDelete(`/api/uploads/file/${file.id}`);
      if (res.ok) setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.error('Error removing file:', err);
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setNewContent({
      title: '',
      description: '',
      content: '',
      category: 'custom',
      doc_type: 'sop',
      tags: '',
      is_published: false
    });
    setAttachedFiles([]);
  };

  // Tab change handler
  const handleTabChange = (tabId) => {
    if (tabId === 'videos') fetchVideoSources();
    if (tabId === 'firm') fetchCustomContent();
    if (tabId === 'library') fetchLibraryBooks();
    if (tabId === 'workbooks') fetchWorkbooks();
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 bg-tactical-animated min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4"></div>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading University...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-tactical-animated min-h-screen page-enter">
      {/* Header */}
      <UniversityHeader
        universityName={universityName}
        isEditingName={isEditingName}
        editedName={editedName}
        setEditedName={setEditedName}
        setIsEditingName={setIsEditingName}
        onSave={saveUniversityName}
        canEdit={canEdit}
      />

      {/* Stats Banner */}
      <StatsBanner stats={stats} />

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTabChange={handleTabChange}
        showFirmContent={canEdit}
      />

      {/* Tab Content */}
      {activeTab === 'courses' && (
        <CoursesTab
          courses={courses}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />
      )}

      {activeTab === 'articles' && (
        <ArticlesTab
          articles={articles}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}

      {activeTab === 'videos' && (
        <VideosTab videoSources={videoSources} />
      )}

      {activeTab === 'certificates' && (
        <CertificatesTab certificates={certificates} />
      )}

      {activeTab === 'firm' && (
        <FirmContentTab
          customContent={customContent}
          onCreateClick={() => setShowCreateModal(true)}
          onTogglePublish={togglePublish}
          onDelete={handleDeleteContent}
        />
      )}

      {activeTab === 'library' && (
        <LibraryTab
          books={libraryBooks}
          loading={libraryLoading}
          onAddClick={() => setShowAddBookModal(true)}
          canEdit={canEdit}
        />
      )}

      {activeTab === 'workbooks' && (
        <WorkbooksTab workbooks={workbooks} />
      )}

      {/* Add Book Modal */}
      <AddBookModal
        show={showAddBookModal}
        onClose={() => setShowAddBookModal(false)}
        onBookAdded={fetchLibraryBooks}
      />

      {/* Create Content Modal */}
      <CreateContentModal
        show={showCreateModal}
        onClose={resetCreateModal}
        createType={createType}
        setCreateType={setCreateType}
        newContent={newContent}
        setNewContent={setNewContent}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
        saving={saving}
        uploadingFile={uploadingFile}
        onSave={handleCreateContent}
        onFileUpload={handleFileUpload}
        onRemoveFile={removeAttachedFile}
      />
    </div>
  );
}

export default University;
