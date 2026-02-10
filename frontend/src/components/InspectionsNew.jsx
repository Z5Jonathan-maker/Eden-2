/**
 * InspectionsNew.jsx - Drodat-Inspired Inspection Module
 * 
 * REDESIGNED with these principles:
 * 1. Claim selection is MANDATORY before anything else
 * 2. Single unified capture experience (no fragmented views)
 * 3. Mobile-first, full-screen camera with prominent voice capture
 * 4. Minimal UI during capture - focus on the task
 * 5. AI-powered photo tagging via voice transcription
 * 
 * Flow:
 * [Select Claim] → [Start Inspection] → [Full-Screen Capture + Voice] → [Review & Upload] → [AI Report]
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Camera, FileText, MapPin, Plus, 
  ChevronRight, Check, Loader2,
  Mic, Image as ImageIcon, Sparkles, FolderOpen,
  Play, History, X
} from 'lucide-react';
import { toast } from 'sonner';
import { NAV_ICONS } from '../assets/badges';
import RapidCapture from './RapidCapture';
import InspectionReportPanel from './InspectionReportPanel';
import { api, API_URL } from '../lib/api';
import { formatDate, formatRelativeTime } from '../lib/core';

const InspectionsNew = () => {
  // State
  const [claims, setClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch claims on mount
  useEffect(() => {
    fetchClaims();
  }, []);

  // Fetch sessions when claim is selected
  useEffect(() => {
    if (selectedClaim?.id) {
      fetchSessions(selectedClaim.id);
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [selectedClaim?.id]);

  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const { ok, data } = await api('/api/claims/');
      if (ok && data) {
        setClaims(data);
      }
    } catch (err) {
      console.error('Failed to fetch claims:', err);
      toast.error('Failed to load claims');
    } finally {
      setLoadingClaims(false);
    }
  };

  const fetchSessions = async (claimId) => {
    setLoadingSessions(true);
    try {
      const { ok, data } = await api(`/api/inspections/sessions?claim_id=${claimId}`, { cache: false });
      if (ok && data) {
        setSessions(data.sessions || []);
        // Auto-select most recent completed session for viewing reports
        const completed = (data.sessions || []).find(s => s.status === 'completed');
        if (completed) {
          setSelectedSession(completed);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleClaimSelect = (claim) => {
    setSelectedClaim(claim);
    setSelectedSession(null);
  };

  const handleStartInspection = () => {
    if (!selectedClaim) {
      toast.error('Please select a claim first');
      return;
    }
    setShowCapture(true);
  };

  const handleCaptureComplete = (photos) => {
    setShowCapture(false);
    // Refresh sessions to show the newly completed one
    if (selectedClaim?.id) {
      fetchSessions(selectedClaim.id);
    }
    toast.success(`Inspection completed with ${photos?.length || 0} photos!`);
  };

  // Filter claims by search
  const filteredClaims = claims.filter(claim => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (claim.claim_number || '').toLowerCase().includes(query) ||
      (claim.client_name || claim.insured_name || '').toLowerCase().includes(query) ||
      (claim.property_address || claim.loss_location || '').toLowerCase().includes(query)
    );
  });

  // If capture mode is active, show full-screen RapidCapture
  if (showCapture) {
    return (
      <RapidCapture
        claimId={selectedClaim?.id}
        claimInfo={selectedClaim}
        onClose={() => setShowCapture(false)}
        onComplete={handleCaptureComplete}
      />
    );
  }

  return (
    <div className="min-h-screen page-enter">
      <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <img src={NAV_ICONS.recon} alt="Recon" className="w-8 h-8 object-contain icon-3d-shadow" />
                <h1 className="text-xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange">Recon Module</h1>
              </div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Capture property photos with voice notes</p>
            </div>
            {selectedClaim && (
              <button 
                onClick={handleStartInspection}
                className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
                data-testid="start-inspection-btn"
              >
                <Camera className="w-4 h-4" />
                <span>Deploy Recon</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Claim Selection */}
          <div className={`lg:col-span-1 ${selectedClaim ? 'hidden lg:block' : ''}`}>
            <div className="card-tactical p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-orange-500" />
                <h2 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Select Target</h2>
              </div>
              
              {/* Search Input - Tactical */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-tactical w-full px-3 py-2 text-sm"
                  data-testid="claim-search-input"
                />
              </div>

              {/* Claims List - Tactical Style */}
              <div className="space-y-2 max-h-[400px] lg:max-h-[500px] overflow-y-auto scrollbar-hide">
                {loadingClaims ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="spinner-tactical w-6 h-6" />
                  </div>
                ) : filteredClaims.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                    <p className="text-sm text-zinc-500 font-mono">No targets found</p>
                  </div>
                ) : (
                  filteredClaims.map(claim => (
                    <button
                      key={claim.id}
                      onClick={() => handleClaimSelect(claim)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedClaim?.id === claim.id
                          ? 'border-orange-500/50 bg-orange-500/10'
                          : 'border-zinc-700/30 bg-zinc-800/30 hover:border-orange-500/30 hover:bg-zinc-800/50'
                      }`}
                      data-testid={`claim-item-${claim.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-zinc-200 truncate text-sm">
                            {claim.client_name || claim.insured_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-zinc-500 truncate font-mono">
                            {claim.property_address || claim.loss_location || 'No address'}
                          </p>
                          {claim.claim_number && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase badge-common">
                              #{claim.claim_number}
                            </span>
                          )}
                        </div>
                        {selectedClaim?.id === claim.id && (
                          <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Selected Claim Details & Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedClaim ? (
              /* No Claim Selected State - Tactical */
              <div className="card-tactical border-2 border-dashed border-zinc-700/50 p-10">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ boxShadow: '0 0 40px rgba(234, 88, 12, 0.3)' }}>
                    <Camera className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-tactical font-bold text-white mb-3 uppercase tracking-wide">
                    Select Target to Begin
                  </h3>
                  <p className="text-zinc-500 text-sm max-w-md mx-auto font-mono">
                    Choose a target from the list to deploy recon or view existing intel.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile: Change Claim Button */}
                <div className="lg:hidden mb-4">
                  <button 
                    onClick={() => setSelectedClaim(null)}
                    className="w-full py-2 px-4 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 text-sm font-mono uppercase flex items-center justify-center gap-2"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Change Target
                  </button>
                </div>

                {/* Selected Claim Card - Tactical */}
                <div className="card-tactical card-tactical-hover p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-600 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(234, 88, 12, 0.3)' }}>
                        <FileText className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-tactical font-bold text-lg text-white">
                          {selectedClaim.client_name || selectedClaim.insured_name || 'Unknown'}
                        </h3>
                        <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1 font-mono">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedClaim.property_address || selectedClaim.loss_location || 'No location'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {selectedClaim.claim_number && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase badge-common">
                              #{selectedClaim.claim_number}
                            </span>
                          )}
                          {selectedClaim.status && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase badge-rare">
                              {selectedClaim.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedClaim(null)}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Start New Inspection CTA - Tactical */}
                <div className="card-tactical p-5 border-l-2 border-green-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center" style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)' }}>
                        <Camera className="w-7 h-7 text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-tactical font-bold text-white uppercase tracking-wide">Deploy New Recon</h3>
                        <p className="text-sm text-zinc-500 font-mono">
                          Capture photos with voice - AI auto-tags
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleStartInspection}
                      className="bg-green-600 hover:bg-green-500 text-white h-12 px-6 rounded font-tactical font-semibold uppercase tracking-wider flex items-center gap-2 transition-all"
                      style={{ boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}
                      data-testid="start-inspection-cta"
                    >
                      <Play className="w-5 h-5" />
                      Deploy
                    </button>
                  </div>
                  
                  {/* Feature Pills */}
                  <div className="flex flex-wrap gap-2 mt-4 ml-[72px]">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs text-zinc-400 font-mono">
                      <Mic className="w-3 h-3" /> Voice
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs text-zinc-400 font-mono">
                      <MapPin className="w-3 h-3" /> GPS
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs text-zinc-400 font-mono">
                      <Sparkles className="w-3 h-3" /> AI Intel
                    </span>
                  </div>
                </div>

                {/* Previous Sessions - Tactical */}
                <div className="card-tactical p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="w-5 h-5 text-zinc-500" />
                    <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Recon History</h3>
                  </div>
                  
                  {loadingSessions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="spinner-tactical w-6 h-6" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                      <p className="text-sm text-zinc-500 font-mono">No previous recon</p>
                      <p className="text-xs text-zinc-600 font-mono mt-1">Deploy first mission above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={`w-full text-left p-4 rounded-lg border transition-all ${
                            selectedSession?.id === session.id
                              ? 'border-purple-500/50 bg-purple-500/10'
                              : 'border-zinc-700/30 bg-zinc-800/30 hover:border-purple-500/30 hover:bg-zinc-800/50'
                          }`}
                          data-testid={`session-item-${session.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                session.status === 'completed' 
                                  ? 'bg-green-500/10 border border-green-500/30' 
                                  : session.status === 'in_progress'
                                  ? 'bg-yellow-500/10 border border-yellow-500/30'
                                  : 'bg-zinc-800/50 border border-zinc-700/50'
                              }`}>
                                <Camera className={`w-5 h-5 ${
                                  session.status === 'completed' 
                                    ? 'text-green-400' 
                                    : session.status === 'in_progress'
                                    ? 'text-yellow-400'
                                    : 'text-zinc-500'
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-zinc-200 text-sm">
                                  {session.name || 'Recon Session'}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                                  <span>{formatRelativeTime(session.created_at)}</span>
                                  <span>•</span>
                                  <span>{session.photo_count || 0} images</span>
                                  {session.voice_transcript && (
                                    <>
                                      <span>•</span>
                                      <span className="text-purple-400 flex items-center gap-0.5">
                                        <Mic className="w-3 h-3" /> Audio
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                session.status === 'completed' 
                                  ? 'badge-uncommon' 
                                  : session.status === 'in_progress'
                                  ? 'badge-legendary'
                                  : 'badge-common'
                              }`}>
                                {session.status === 'completed' ? 'Complete' : 
                                 session.status === 'in_progress' ? 'Active' : session.status}
                              </span>
                              <ChevronRight className="w-4 h-4 text-zinc-600" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Report Panel for Selected Session */}
                {selectedSession && (
                  <InspectionReportPanel
                    sessionId={selectedSession.id}
                    sessionStatus={selectedSession.status}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectionsNew;
