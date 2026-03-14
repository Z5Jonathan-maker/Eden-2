import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { apiGet } from '@/lib/api';
import {
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  DollarSign,
  FileCheck,
  Loader2,
  Clock,
  CheckCircle2,
  FileText,
  MessageSquare,
  LogOut,
} from 'lucide-react';

const ClientClaimDetails = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [claim, setClaim] = useState(null);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchClaimData = useCallback(async () => {
    try {
      setLoading(true);
      const [claimRes, notesRes, docsRes] = await Promise.all([
        apiGet(`/api/claims/${claimId}`),
        apiGet(`/api/claims/${claimId}/notes`).catch(() => ({ ok: false, data: [] })),
        apiGet(`/api/claims/${claimId}/documents`).catch(() => ({ ok: false, data: [] })),
      ]);

      if (!claimRes.ok) {
        throw new Error(claimRes.error || 'Failed to fetch claim');
      }

      setClaim(claimRes.data);
      setNotes(notesRes.ok ? notesRes.data : []);
      setDocuments(docsRes.ok ? docsRes.data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchClaimData();
  }, [fetchClaimData]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    const colors = {
      New: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      'In Progress': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      'Under Review': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      Completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
      Closed: 'bg-gray-500/20 text-zinc-500 border border-gray-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-zinc-500';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const LIFECYCLE = ['Intake', 'Inspection', 'Negotiation', 'Settlement'];
  const getLifecycleStep = (status) => {
    const map = { New: 0, 'In Progress': 1, 'Under Review': 2, Completed: 3, Closed: 4 };
    return map[status] ?? 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="bg-[#1a1a1a] border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">CC</span>
            </div>
            <h1 className="text-xl font-bold text-white">Care Claims Portal</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-zinc-500 mb-4">{error || 'Claim not found'}</p>
          <Button onClick={() => navigate('/client')} className="bg-orange-600 hover:bg-orange-700">
            Back to Portal
          </Button>
        </main>
      </div>
    );
  }

  const step = getLifecycleStep(claim.status);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">CC</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Care Claims Portal</h1>
              <p className="text-sm text-zinc-500">Claim Details</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-zinc-500">
              <User className="w-4 h-4" />
              <span>{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-white hover:bg-white/10">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/client')}
          className="mb-6 text-zinc-500 hover:text-white hover:bg-white/10"
          data-testid="back-to-portal"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Claims
        </Button>

        {/* Claim Header + Lifecycle Progress */}
        <Card className="mb-6 bg-[#1a1a1a] border-white/10">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-white" data-testid="claim-number">
                    {claim.claim_number}
                  </h2>
                  <Badge className={getStatusColor(claim.status)} data-testid="claim-status">
                    {claim.status}
                  </Badge>
                </div>
                <p className="text-zinc-500">{claim.claim_type}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  ${(claim.estimated_value || 0).toLocaleString()}
                </p>
                <p className="text-sm text-zinc-500">Estimated Value</p>
              </div>
            </div>

            {/* Lifecycle Progress Bar */}
            <div>
              <p className="text-sm text-zinc-500 mb-3">Claim Progress</p>
              <div className="flex items-center gap-2">
                {LIFECYCLE.map((s, i) => (
                  <div key={s} className="flex-1">
                    <div className={`h-2 rounded-full mb-2 transition-all ${i <= step ? 'bg-orange-500' : 'bg-white/10'}`} />
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                        i < step ? 'bg-green-500 text-white' : i === step ? 'bg-orange-500 text-white ring-2 ring-orange-500/30' : 'bg-white/10 text-zinc-500'
                      }`}>
                        {i < step ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={`text-xs ${i <= step ? 'text-orange-400 font-medium' : 'text-zinc-500'}`}>{s}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-[#1a1a1a] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-white">Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm text-zinc-500">Property Address</p>
                  <p className="font-medium text-white">{claim.property_address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm text-zinc-500">Date of Loss</p>
                  <p className="font-medium text-white">{claim.date_of_loss}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileCheck className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm text-zinc-500">Policy Number</p>
                  <p className="font-medium text-white">{claim.policy_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-white">Your Adjuster</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-white text-lg">{claim.assigned_to || 'Pending Assignment'}</p>
                  <p className="text-sm text-zinc-500">Assigned Adjuster</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm text-zinc-500">Last Updated</p>
                  <p className="font-medium text-white">{formatDate(claim.updated_at)}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <p className="text-sm text-zinc-500">Claim Filed</p>
                  <p className="font-medium text-white">{formatDate(claim.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {claim.description && (
          <Card className="mb-6 bg-[#1a1a1a] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg text-white">Claim Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{claim.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Activity / Notes */}
        <Card className="mb-6 bg-[#1a1a1a] border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-white">
              <MessageSquare className="w-5 h-5 mr-2 text-orange-500" />
              Activity & Updates ({notes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">No updates yet</p>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 bg-white/[0.03] rounded-lg border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-white">{note.author_name}</p>
                      <p className="text-xs text-zinc-500">{formatDate(note.created_at)}</p>
                    </div>
                    <p className="text-gray-300">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="bg-[#1a1a1a] border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-white">
              <FileText className="w-5 h-5 mr-2 text-orange-500" />
              Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-zinc-500 text-center py-4">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-white/[0.03] rounded-lg border border-white/10 flex items-center justify-between hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{doc.name}</p>
                        <p className="text-xs text-zinc-500">
                          {doc.type} &middot; {formatDate(doc.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-white/20 text-zinc-500 hover:text-white hover:bg-white/10">
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] border-t border-white/10 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-zinc-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Care Claims, Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientClaimDetails;
