import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import ApiService from '../services/ApiService';
import { ArrowLeft, Edit, MessageSquare, FileText, Camera, User, Calendar, MapPin, DollarSign, FileCheck, Loader2, Upload, Download, X, ExternalLink, Presentation, ChevronDown, Clock, CalendarPlus, Phone, Target, Shield, ChevronRight } from 'lucide-react';
import ClaimCommsPanel from './ClaimCommsPanel';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { useGamma, GAMMA_AUDIENCES } from '../hooks/useGamma';
import ClientStatusPanel from './ClientStatusPanel';
import { FEATURE_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to get auth token for image URLs
const getToken = () => localStorage.getItem('eden_token') || '';

const ClaimDetails = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [notionPage, setNotionPage] = useState(null);
  const [creatingNotionPage, setCreatingNotionPage] = useState(false);
  const [showDeckMenu, setShowDeckMenu] = useState(false);
  const [generatingDeck, setGeneratingDeck] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  
  // Gamma hook for presentation generation
  const { createDeckForAudience, loading: gammaLoading } = useGamma();

  // Calendar scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingAppointment, setSchedulingAppointment] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: 60,
    location: '',
    description: ''
  });

  useEffect(() => {
    fetchClaimData();
    fetchClaimPhotos();
    fetchNotionPage();
  }, [claimId]);

  const fetchClaimPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/inspections/claim/${claimId}/photos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to fetch claim photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchNotionPage = async () => {
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/notion/claim-page/${claimId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setNotionPage(data);
        }
      }
    } catch (err) {
      // console.log('Notion page not found');
    }
  };

  const createNotionStrategyPage = async () => {
    setCreatingNotionPage(true);
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/notion/claim-page/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ claim_id: claimId })
      });
      
      const data = await res.json();
      
      if (res.ok && (data.success || data.exists)) {
        setNotionPage({ exists: true, url: data.url, page_id: data.page_id });
        toast.success('Strategy page created in Notion!');
        // Open the page
        if (data.url) {
          window.open(data.url, '_blank');
        }
      } else {
        toast.error(data.detail || 'Failed to create Notion page');
      }
    } catch (err) {
      toast.error('Failed to create Notion page');
    } finally {
      setCreatingNotionPage(false);
    }
  };

  const fetchClaimData = async () => {
    try {
      setLoading(true);
      const [claimData, notesData, docsData] = await Promise.all([
        ApiService.getClaim(claimId),
        ApiService.getClaimNotes(claimId).catch(() => []),
        ApiService.getClaimDocuments(claimId).catch(() => [])
      ]);
      setClaim(claimData);
      setEditForm(claimData);
      setNotes(notesData);
      setDocuments(docsData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open schedule modal with pre-filled data
  const openScheduleModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    setAppointmentForm({
      title: `Inspection - ${claim?.client_name || 'Client'}`,
      date: dateStr,
      time: '10:00',
      duration: 60,
      location: claim?.property_address || '',
      description: `Claim: ${claim?.claim_number}\nType: ${claim?.claim_type || 'Property'}\n\nScheduled inspection for ${claim?.client_name}`
    });
    setShowScheduleModal(true);
  };

  // Schedule appointment via Google Calendar API
  const handleScheduleAppointment = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSchedulingAppointment(true);
    try {
      const token = localStorage.getItem('eden_token');
      
      // Build start and end times
      const startDateTime = new Date(`${appointmentForm.date}T${appointmentForm.time}`);
      const endDateTime = new Date(startDateTime.getTime() + (appointmentForm.duration * 60 * 1000));
      
      const eventPayload = {
        title: appointmentForm.title,
        description: appointmentForm.description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location: appointmentForm.location,
        attendees: claim?.client_email ? [claim.client_email] : [],
        reminder_minutes: 30
      };

      const res = await fetch(`${API_URL}/api/integrations/google/calendar/events?claim_id=${claimId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(eventPayload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Appointment scheduled!', {
          description: `${appointmentForm.title} on ${new Date(appointmentForm.date).toLocaleDateString()}`
        });
        setShowScheduleModal(false);
        
        // Add note about the scheduled appointment
        const appointmentNote = `📅 Appointment scheduled: ${appointmentForm.title} on ${new Date(appointmentForm.date).toLocaleDateString()} at ${appointmentForm.time}`;
        try {
          const note = await ApiService.addClaimNote(claimId, appointmentNote);
          setNotes([note, ...notes]);
        } catch (e) {
          // Note failed, but appointment was created
        }
      } else if (res.status === 401) {
        toast.error('Google Calendar not connected', {
          description: 'Connect your Google account in Settings > Integrations',
          action: {
            label: 'Connect',
            onClick: () => navigate('/settings/integrations')
          }
        });
      } else {
        toast.error(data.detail || 'Failed to schedule appointment');
      }
    } catch (err) {
      console.error('Schedule error:', err);
      toast.error('Failed to schedule appointment');
    } finally {
      setSchedulingAppointment(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      setAddingNote(true);
      const note = await ApiService.addClaimNote(claimId, newNote.trim());
      setNotes([note, ...notes]);
      setNewNote('');
    } catch (err) {
      toast.error('Failed to add note: ' + err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditClaim = () => {
    setIsEditing(true);
    setEditForm({ ...claim });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({ ...claim });
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const updated = await ApiService.updateClaim(claimId, editForm);
      setClaim(updated);
      setIsEditing(false);
      toast.success('Claim updated successfully');
    } catch (err) {
      toast.error('Failed to update claim: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      
      // Generate a PDF report (client-side for now)
      const reportContent = `
CLAIM REPORT
============

Claim Number: ${claim.claim_number}
Status: ${claim.status}
Priority: ${claim.priority}

CLIENT INFORMATION
------------------
Client Name: ${claim.client_name}
Client Email: ${claim.client_email || 'N/A'}
Client Phone: ${claim.client_phone || 'N/A'}

PROPERTY INFORMATION
--------------------
Property Address: ${claim.property_address}
Date of Loss: ${claim.date_of_loss}
Claim Type: ${claim.claim_type}

POLICY INFORMATION
------------------
Policy Number: ${claim.policy_number}
Insurance Company: ${claim.insurance_company || 'N/A'}
Estimated Value: $${(claim.estimated_value || 0).toLocaleString()}

DESCRIPTION
-----------
${claim.description || 'No description provided'}

NOTES (${notes.length})
-----------
${notes.map(n => `[${new Date(n.created_at).toLocaleDateString()}] ${n.author_name}: ${n.content}`).join('\n\n') || 'No notes'}

Generated on: ${new Date().toLocaleString()}
      `.trim();
      
      // Download as text file
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claim-report-${claim.claim_number}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Handle Gamma deck generation - uses claim ID, backend fetches all data
  const handleGenerateDeck = async (audience) => {
    try {
      setGeneratingDeck(audience);
      setShowDeckMenu(false);
      
      // Use the new endpoint that fetches data from DB
      const result = await createDeckForAudience(claim.id, audience);
      
      if (result.edit_url) {
        toast.success(`${GAMMA_AUDIENCES[audience]?.name || 'Presentation'} deck created!`, {
          action: {
            label: 'Open in Gamma',
            onClick: () => window.open(result.edit_url, '_blank')
          }
        });
        // Auto-open the deck
        window.open(result.edit_url, '_blank');
      } else {
        toast.success('Deck created successfully');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate deck');
    } finally {
      setGeneratingDeck(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'In Progress') return 'badge-rare';
    if (status === 'Under Review') return 'badge-epic';
    if (status === 'Completed') return 'badge-uncommon';
    return 'badge-common';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading mission data...</p>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
            <X className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 mb-4 font-mono">{error || 'Mission not found'}</p>
          <button onClick={() => navigate('/claims')} className="btn-tactical px-6 py-2.5 text-sm">
            Return to Garden
          </button>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(claim.status);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      {/* Header - Tactical Style */}
      <div className="mb-4 md:mb-6 animate-fade-in-up">
        <button 
          onClick={() => navigate('/claims')} 
          className="mb-4 px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          data-testid="back-to-claims"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Garden
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange" data-testid="claim-number">{claim.claim_number}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColor}`} data-testid="claim-status">{claim.status}</span>
            </div>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">{claim.claim_type}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {notionPage?.exists ? (
              <button 
                className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                onClick={() => window.open(notionPage.url, '_blank')}
                data-testid="notion-page-btn"
              >
                <ExternalLink className="w-4 h-4" />
                Strategy Page
              </button>
            ) : (
              <button 
                className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                onClick={createNotionStrategyPage}
                disabled={creatingNotionPage}
                data-testid="create-notion-btn"
              >
                {creatingNotionPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Create Strategy
              </button>
            )}
            <button 
              className="px-4 py-2 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={async () => {
                const address = claim?.property_address || 'No address';
                const text = `Claim ${claim?.claim_number}: ${claim?.client_name}\nProperty: ${address}`;
                
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const mapLink = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
                      const fullText = `${text}\nGPS: ${mapLink}`;
                      
                      if (navigator.share) {
                        navigator.share({ title: `Claim ${claim?.claim_number}`, text: fullText }).catch(() => {
                          navigator.clipboard.writeText(fullText);
                          toast.success('Location copied to clipboard');
                        });
                      } else {
                        navigator.clipboard.writeText(fullText);
                        toast.success('Location + claim info copied!');
                      }
                    },
                    () => {
                      if (navigator.share) {
                        navigator.share({ title: `Claim ${claim?.claim_number}`, text }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(text);
                        toast.success('Claim info copied (GPS unavailable)');
                      }
                    },
                    { timeout: 5000 }
                  );
                } else {
                  navigator.clipboard.writeText(text);
                  toast.success('Claim info copied');
                }
              }}
              data-testid="share-location-btn"
            >
              <MapPin className="w-4 h-4" />
              Share Location
            </button>
            <button 
              className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2" 
              onClick={handleEditClaim}
              data-testid="edit-claim-btn"
            >
              <Edit className="w-4 h-4" />
              Edit Mission
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal - Tactical Style */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card-tactical p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-tactical font-bold text-white uppercase tracking-wide">Edit Mission</h2>
              <button onClick={handleCancelEdit} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Client Name</label>
                  <input 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    value={editForm.client_name || ''} 
                    onChange={(e) => setEditForm({...editForm, client_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Status</label>
                  <select 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    value={editForm.status || 'New'}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  >
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Property Address</label>
                  <input 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    value={editForm.property_address || ''} 
                    onChange={(e) => setEditForm({...editForm, property_address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Estimated Value ($)</label>
                  <input 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    type="number"
                    value={editForm.estimated_value || 0} 
                    onChange={(e) => setEditForm({...editForm, estimated_value: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Priority</label>
                  <select 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    value={editForm.priority || 'Medium'}
                    onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Assigned To</label>
                  <input 
                    className="input-tactical w-full px-3 py-2 text-sm"
                    value={editForm.assigned_to || ''} 
                    onChange={(e) => setEditForm({...editForm, assigned_to: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">Description</label>
                <textarea 
                  className="input-tactical w-full px-3 py-2 text-sm min-h-[100px]"
                  value={editForm.description || ''} 
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700/50">
                <button 
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase transition-all"
                >
                  Cancel
                </button>
                <button 
                  className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Claim Information - Tactical Style */}
        <div className="lg:col-span-2 card-tactical p-5">
          <div className="flex items-center gap-3 mb-5">
            <Target className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">Mission Intel</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Client Name</p>
                <p className="font-medium text-zinc-200 truncate" data-testid="client-name">{claim.client_name}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Date of Loss</p>
                <p className="font-medium text-zinc-200">{claim.date_of_loss}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex-shrink-0">
                <MapPin className="w-4 h-4 text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Property Address</p>
                <p className="font-medium text-zinc-200 break-words">{claim.property_address}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                <DollarSign className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Estimated Value</p>
                <p className="font-tactical font-bold text-orange-400 text-lg">${(claim.estimated_value || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                <FileCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Policy Number</p>
                <p className="font-medium text-zinc-200 font-mono">{claim.policy_number}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-zinc-500/10 border border-zinc-500/20 flex-shrink-0">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Assigned To</p>
                <p className="font-medium text-zinc-200">{claim.assigned_to || 'Unassigned'}</p>
              </div>
            </div>
          </div>
          {claim.description && (
            <div className="mt-6 pt-6 border-t border-zinc-700/50">
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-2">Description</p>
              <p className="text-zinc-300 break-words">{claim.description}</p>
            </div>
          )}
        </div>

        {/* Quick Actions - Tactical Style */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">Quick Deploy</h2>
          </div>
          <div className="space-y-3">
            {/* Schedule Appointment */}
            <button 
              className="w-full px-4 py-3 rounded bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={openScheduleModal}
              data-testid="schedule-appointment-btn"
            >
              <CalendarPlus className="w-4 h-4" />
              Schedule Appointment
            </button>
            
            <button 
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={() => navigate('/inspections')} 
              data-testid="start-inspection-btn"
            >
              <Camera className="w-4 h-4" />
              Start Recon
            </button>
            <button 
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-blue-400 hover:border-blue-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={() => navigate('/eve')} 
              data-testid="ask-eve-btn"
            >
              <MessageSquare className="w-4 h-4" />
              Agent Eve
            </button>
            <button 
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={handleGenerateReport}
              disabled={generatingReport}
              data-testid="generate-report-btn"
            >
              {generatingReport ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
              ) : (
                <><FileText className="w-4 h-4" />Generate Report</>
              )}
            </button>
            
            {/* Gamma Presentation Decks */}
            <div className="relative">
              <button 
                className="w-full px-4 py-3 rounded bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400 hover:from-blue-600/30 hover:to-purple-600/30 font-mono text-xs uppercase flex items-center justify-between transition-all"
                onClick={() => setShowDeckMenu(!showDeckMenu)}
                disabled={!!generatingDeck}
                data-testid="gamma-deck-btn"
              >
                <span className="flex items-center gap-2">
                  {generatingDeck ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Presentation className="w-4 h-4" />
                  )}
                  {generatingDeck ? `Creating ${GAMMA_AUDIENCES[generatingDeck]?.name}...` : 'Generate Deck'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDeckMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showDeckMenu && (
                <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-700/50">Select Deck Type</div>
                  
                  {/* Client-Facing Decks */}
                  <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50">Client Decks</div>
                  <button
                    onClick={() => handleGenerateDeck('client_update')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-client-update"
                  >
                    <span>📋</span> 
                    <div>
                      <div className="font-medium">Client Update</div>
                      <div className="text-[10px] text-zinc-500">Status update for homeowner</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('client_approval')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-client-approval"
                  >
                    <span>✅</span>
                    <div>
                      <div className="font-medium">Settlement Review</div>
                      <div className="text-[10px] text-zinc-500">For client approval</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('settlement')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-settlement"
                  >
                    <span>🎉</span>
                    <div>
                      <div className="font-medium">Final Settlement</div>
                      <div className="text-[10px] text-zinc-500">Celebratory closing deck</div>
                    </div>
                  </button>
                  
                  {/* Internal Decks */}
                  <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50 border-t border-zinc-700/50">Internal Decks</div>
                  <button
                    onClick={() => handleGenerateDeck('rep_performance')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-rep-performance"
                  >
                    <span>📊</span>
                    <div>
                      <div className="font-medium">Rep Performance</div>
                      <div className="text-[10px] text-zinc-500">Sales/adjuster review</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('pastor_report')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-pastor-report"
                  >
                    <span>✝️</span>
                    <div>
                      <div className="font-medium">Ministry Report</div>
                      <div className="text-[10px] text-zinc-500">Kingdom impact report</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Status Panel - Stage Progress and Eve Updates */}
      <div className="mb-4 md:mb-6">
        <ClientStatusPanel claimId={claimId} isClientView={false} />
      </div>

      {/* Tabs Section - Tactical Style */}
      <div className="card-tactical p-5">
        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1">
            <TabsTrigger value="notes" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase" data-testid="notes-tab">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="photos" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase" data-testid="photos-tab">
              <Camera className="w-4 h-4 mr-1" />
              ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase" data-testid="messages-tab">
              <Phone className="w-4 h-4 mr-1" />
              Comms
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase" data-testid="documents-tab">Docs ({documents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4 md:mt-6">
            <div className="mb-4 md:mb-6">
              <textarea 
                placeholder="Add a note... Use @name to tag team members" 
                value={newNote} 
                onChange={(e) => setNewNote(e.target.value)} 
                className="input-tactical w-full px-3 py-3 text-sm min-h-[80px] mb-3" 
                rows={3}
                data-testid="new-note-input"
              />
              <button 
                onClick={handleAddNote} 
                className="btn-tactical px-5 py-2.5 text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                disabled={addingNote || !newNote.trim()}
                data-testid="add-note-btn"
              >
                {addingNote ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : 'Add Note'}
              </button>
            </div>
            
            <div className="space-y-4">
              {notes.length > 0 ? notes.map((note) => (
                <div key={note.id} className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30" data-testid={`note-${note.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-400 text-xs font-tactical font-medium">{getInitials(note.author_name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-200 text-sm truncate">{note.author_name}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{formatDate(note.created_at)}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-300 break-words text-sm">{note.content}</p>
                </div>
              )) : (
                <p className="text-zinc-500 text-center py-4 font-mono text-sm">No notes yet. Add the first note above.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4 md:mt-6">
            <ClaimCommsPanel 
              claimId={claimId} 
              clientPhone={claim.client_phone}
              clientName={claim.client_name}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-4 md:mt-6">
            {loadingPhotos ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner-tactical w-6 h-6" />
              </div>
            ) : photos.length > 0 ? (
              <div className="space-y-4">
                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div 
                      key={photo.id} 
                      className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700/50 cursor-pointer hover:border-orange-500/50 transition-all group"
                      onClick={() => setSelectedPhoto(photo)}
                      data-testid={`photo-${photo.id}`}
                    >
                      <img 
                        src={`${API_URL}/api/inspections/photos/${photo.id}/image?token=${getToken()}`}
                        alt={photo.room || 'Inspection photo'}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay with info */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-medium truncate">{photo.room || 'No room'}</p>
                          {photo.category && (
                            <p className="text-white/70 text-[10px] truncate">{photo.category}</p>
                          )}
                        </div>
                      </div>
                      {/* Voice note indicator */}
                      {photo.voice_transcript && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/>
                            <line x1="8" y1="23" x2="16" y2="23"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Photo count summary */}
                <div className="text-xs text-zinc-500 text-center font-mono">
                  {photos.length} photo{photos.length !== 1 ? 's' : ''} from inspections
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                  <Camera className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-400 mb-2 font-tactical">No Photos Captured</p>
                <p className="text-xs text-zinc-600 mb-4 font-mono">Start an inspection to capture photos</p>
                <button 
                  onClick={() => navigate(`/inspections`)}
                  className="btn-tactical px-5 py-2.5 text-sm"
                  data-testid="start-inspection-from-photos-btn"
                >
                  <Camera className="w-4 h-4 mr-2 inline" />
                  Deploy Recon
                </button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4 md:mt-6">
            <div className="space-y-3">
              {documents.length > 0 ? documents.map((doc) => (
                <div key={doc.id} className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-500/30 transition-colors" data-testid={`doc-${doc.id}`}>
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                      <FileText className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 truncate">{doc.name}</p>
                      <p className="text-xs text-zinc-500 font-mono">{doc.type} • {doc.size}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">Uploaded by {doc.uploaded_by} on {formatDate(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <button className="px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all w-full sm:w-auto justify-center">
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              )) : (
                <p className="text-zinc-500 text-center py-4 font-mono text-sm">No documents uploaded yet.</p>
              )}
            </div>
            <button className="w-full mt-4 px-4 py-3 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all" data-testid="upload-document-btn">
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Appointment Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-green-600" />
              Schedule Appointment
            </DialogTitle>
            <DialogDescription>
              Create an appointment for this claim
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="apt-title">Title *</Label>
              <Input
                id="apt-title"
                value={appointmentForm.title}
                onChange={(e) => setAppointmentForm({...appointmentForm, title: e.target.value})}
                placeholder="e.g., Property Inspection"
                data-testid="apt-title-input"
              />
            </div>

            {/* Date & Time Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="apt-date">Date *</Label>
                <Input
                  id="apt-date"
                  type="date"
                  value={appointmentForm.date}
                  onChange={(e) => setAppointmentForm({...appointmentForm, date: e.target.value})}
                  data-testid="apt-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-time">Time *</Label>
                <Input
                  id="apt-time"
                  type="time"
                  value={appointmentForm.time}
                  onChange={(e) => setAppointmentForm({...appointmentForm, time: e.target.value})}
                  data-testid="apt-time-input"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="apt-duration">Duration</Label>
              <select
                id="apt-duration"
                value={appointmentForm.duration}
                onChange={(e) => setAppointmentForm({...appointmentForm, duration: parseInt(e.target.value)})}
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                data-testid="apt-duration-select"
              >
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="apt-location">Location</Label>
              <Input
                id="apt-location"
                value={appointmentForm.location}
                onChange={(e) => setAppointmentForm({...appointmentForm, location: e.target.value})}
                placeholder="Property address"
                data-testid="apt-location-input"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="apt-description">Notes</Label>
              <Textarea
                id="apt-description"
                value={appointmentForm.description}
                onChange={(e) => setAppointmentForm({...appointmentForm, description: e.target.value})}
                placeholder="Additional details..."
                rows={3}
                data-testid="apt-description-input"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowScheduleModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleScheduleAppointment}
                disabled={schedulingAppointment}
                data-testid="confirm-schedule-btn"
              >
                {schedulingAppointment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Viewer Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedPhoto && (
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* Image */}
              <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[70vh]">
                <img 
                  src={`${API_URL}/api/inspections/photos/${selectedPhoto.id}/image?token=${getToken()}`}
                  alt={selectedPhoto.room || 'Inspection photo'}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
              
              {/* Photo Details */}
              <div className="p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedPhoto.room || 'Inspection Photo'}
                    </h3>
                    {selectedPhoto.category && (
                      <p className="text-sm text-gray-500">{selectedPhoto.category}</p>
                    )}
                    {selectedPhoto.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Captured {new Date(selectedPhoto.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href={`${API_URL}/api/inspections/photos/${selectedPhoto.id}/image?token=${getToken()}`} 
                      download={`photo-${selectedPhoto.id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
                
                {/* Voice Transcript */}
                {selectedPhoto.voice_transcript && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-purple-700">Voice Note</span>
                    </div>
                    <p className="text-sm text-gray-700">{selectedPhoto.voice_transcript}</p>
                  </div>
                )}
                
                {/* AI Tags */}
                {selectedPhoto.ai_tags && selectedPhoto.ai_tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selectedPhoto.ai_tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClaimDetails;
