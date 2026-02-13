/**
 * University Component - Main Container
 * Internal training, standards, and doctrine platform
 * 
 * Refactored to use modular components from ./university/
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import UniversityHeader from './university/UniversityHeader';
import StatsBanner from './university/StatsBanner';
import TabNavigation from './university/TabNavigation';
import CoursesTab from './university/CoursesTab';
import ArticlesTab from './university/ArticlesTab';
import VideosTab from './university/VideosTab';
import CertificatesTab from './university/CertificatesTab';
import FirmContentTab from './university/FirmContentTab';
import CreateContentModal from './university/CreateContentModal';

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

  const getToken = useCallback(() => localStorage.getItem('eden_token'), []);
  const canEdit = user && (user.role === 'admin' || user.role === 'manager');

  // API Functions
  const fetchCompanySettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/company`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      const name = data.company_name || 'Your Firm';
      const uniName = data.university_name || `${name} University`;
      setCompanyName(name);
      setUniversityName(uniName);
      setEditedName(uniName);
    } catch {
      setCompanyName('Your Firm');
      setUniversityName('Your Firm University');
      setEditedName('Your Firm University');
    }
  }, [getToken]);

  const saveUniversityName = async () => {
    try {
      await fetch(`${API_URL}/api/settings/company`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ university_name: editedName })
      });
      setUniversityName(editedName);
      setIsEditingName(false);
    } catch {
      alert('Failed to save university name');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const headers = { 'Authorization': `Bearer ${getToken()}` };
    
    try {
      const [coursesRes, articlesRes, statsRes, certsRes] = await Promise.all([
        fetch(`${API_URL}/api/university/courses`, { headers }),
        fetch(`${API_URL}/api/university/articles`, { headers }),
        fetch(`${API_URL}/api/university/stats`, { headers }),
        fetch(`${API_URL}/api/university/certificates`, { headers })
      ]);

      const [coursesData, articlesData, statsData, certsData] = await Promise.all([
        coursesRes.json(),
        articlesRes.json(),
        statsRes.json(),
        certsRes.json()
      ]);

      setCourses(coursesData || []);
      setArticles(articlesData || []);
      setStats(statsData);
      setCertificates(certsData || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchVideoSources = async () => {
    try {
      const res = await fetch(`${API_URL}/api/university/video-sources`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      setVideoSources(data);
    } catch {
      // Silently fail
    }
  };

  const fetchCustomContent = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/university/custom/all`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      setCustomContent(data);
    } catch (err) {
      console.error('Failed to fetch custom content:', err);
    }
  }, [getToken]);

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
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Failed to create');
      const data = await res.json();

      // Attach files to the created content
      await Promise.all(attachedFiles.map(file => {
        const formData = new FormData();
        formData.append('content_id', data.id);
        formData.append('content_type', createType);
        return fetch(`${API_URL}/api/uploads/file/${file.id}/attach`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${getToken()}` },
          body: formData
        });
      }));

      resetCreateModal();
      fetchCustomContent();
      fetchData();
    } catch (err) {
      alert('Error creating content: ' + err.message);
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
      const res = await fetch(`${API_URL}${endpoints[type]}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchCustomContent();
      fetchData();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const togglePublish = async (type, item) => {
    const endpoints = {
      article: `/api/university/custom/articles/${item.id}`,
      document: `/api/university/custom/documents/${item.id}`,
      course: `/api/university/custom/courses/${item.id}`
    };

    try {
      const res = await fetch(`${API_URL}${endpoints[type]}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...item, is_published: !item.is_published })
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchCustomContent();
      fetchData();
    } catch (err) {
      alert('Error updating: ' + err.message);
    }
  };

  // File Upload Handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('File too large. Maximum size is 50MB.');
      return;
    }

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/api/uploads/file`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      setAttachedFiles(prev => [...prev, {
        id: data.id,
        filename: data.original_name,
        size: data.size,
        url: API_URL + data.url
      }]);
    } catch (err) {
      alert('Error uploading file: ' + err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const removeAttachedFile = async (index) => {
    const file = attachedFiles[index];
    try {
      await fetch(`${API_URL}/api/uploads/file/${file.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      setAttachedFiles(prev => prev.filter((_, i) => i !== index));
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
