import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { apiGet } from '@/lib/api';
import NotificationBell from './NotificationBell';
import {
  FolderOpen,
  Clock,
  CheckCircle2,
  FileText,
  LogOut,
  User,
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

const ClientPortal = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/claims/');

      if (!res.ok) {
        throw new Error(res.error || 'Failed to fetch claims');
      }

      setClaims(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      Closed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const LIFECYCLE_STEPS = ['Intake', 'Inspection', 'Negotiation', 'Settlement'];
  const getLifecycleStep = (status) => {
    const map = { New: 0, 'In Progress': 1, 'Under Review': 2, Completed: 3, Closed: 4 };
    return map[status] ?? 0;
  };

  const getStatusIcon = (status) => {
    if (status === 'Completed' || status === 'Closed') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-yellow-500" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const safeClaims = Array.isArray(claims) ? claims : [];
  const stats = {
    total: safeClaims.length,
    active: safeClaims.filter((c) => !['Completed', 'Closed'].includes(c.status)).length,
    completed: safeClaims.filter((c) => c.status === 'Completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">CC</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Care Claims Portal</h1>
              <p className="text-sm text-zinc-400">Track your claims</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <div className="hidden sm:flex items-center space-x-2 text-sm text-zinc-500">
              <User className="w-4 h-4" />
              <span data-testid="client-name">{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="client-logout" className="min-h-[44px] text-zinc-500 hover:text-white hover:bg-white/10">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h2>
          <p className="text-zinc-500">Here's the status of your insurance claims</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card data-testid="stat-total" className="bg-[#1a1a1a] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Total Claims</p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <FolderOpen className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-active" className="bg-[#1a1a1a] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Active Claims</p>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-400">{stats.active}</p>
                </div>
                <Clock className="w-10 h-10 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-completed" className="bg-[#1a1a1a] border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400 mb-1">Completed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-400">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Center Quick Access */}
        <Card className="mb-6 bg-gradient-to-r from-orange-600/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Client Resource Center</h3>
                  <p className="text-sm text-zinc-500">
                    Learn about your claim, timelines, and FAQs
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/client/learn')}
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto min-h-[44px]"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims List */}
        <Card className="bg-[#1a1a1a] border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Your Claims</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchClaims}
                data-testid="refresh-claims"
                className="border-white/20 text-zinc-500 hover:text-white hover:bg-white/10"
              >
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 p-4 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">{error}</div>}

            {claims.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-zinc-400 mx-auto mb-4" />
                <p className="text-zinc-500 mb-2">No claims found</p>
                <p className="text-sm text-zinc-400">Contact us if you believe this is an error</p>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim) => {
                  const step = getLifecycleStep(claim.status);
                  return (
                  <div
                    key={claim.id}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedClaim?.id === claim.id
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-white/10 hover:border-orange-500/40 hover:bg-white/[0.02]'
                    }`}
                    onClick={() => setSelectedClaim(selectedClaim?.id === claim.id ? null : claim)}
                    data-testid={`client-claim-${claim.id}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex items-start space-x-4">
                        {getStatusIcon(claim.status)}
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-white">{claim.claim_number}</span>
                            <Badge className={getStatusColor(claim.status)}>{claim.status}</Badge>
                          </div>
                          <p className="text-sm text-zinc-500">{claim.claim_type}</p>
                          <p className="text-sm text-zinc-400">{claim.property_address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          ${(claim.estimated_value || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-zinc-400">Estimated Value</p>
                      </div>
                    </div>

                    {/* Lifecycle Progress Bar */}
                    <div className="mt-3 flex items-center gap-1">
                      {LIFECYCLE_STEPS.map((s, i) => (
                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full h-1.5 rounded-full ${i <= step ? 'bg-orange-500' : 'bg-white/10'}`} />
                          <span className={`text-[10px] ${i <= step ? 'text-orange-400' : 'text-zinc-400'}`}>{s}</span>
                        </div>
                      ))}
                    </div>

                    {/* Expanded Details */}
                    {selectedClaim?.id === claim.id && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        {/* Trust-building: Adjuster + Last Update */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="p-3 bg-white/[0.03] rounded-lg">
                            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Your Adjuster</p>
                            <p className="font-medium text-white">{claim.assigned_to || 'Pending Assignment'}</p>
                          </div>
                          <div className="p-3 bg-white/[0.03] rounded-lg">
                            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Last Updated</p>
                            <p className="font-medium text-white">{formatDate(claim.updated_at)}</p>
                          </div>
                          <div className="p-3 bg-white/[0.03] rounded-lg">
                            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Date of Loss</p>
                            <p className="font-medium text-white">{claim.date_of_loss}</p>
                          </div>
                          <div className="p-3 bg-white/[0.03] rounded-lg">
                            <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Policy Number</p>
                            <p className="font-medium text-white">{claim.policy_number}</p>
                          </div>
                        </div>
                        {claim.description && (
                          <div className="mt-4">
                            <p className="text-zinc-400 text-sm">Description</p>
                            <p className="text-gray-300 mt-1">{claim.description}</p>
                          </div>
                        )}
                        <div className="mt-4 flex space-x-2">
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/client/claims/${claim.id}`);
                            }}
                            data-testid={`view-claim-${claim.id}`}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View Full Details
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="mt-8 bg-gradient-to-r from-orange-600 to-orange-700 border-0">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-white mb-2">Questions About Your Claim?</h3>
            <p className="text-orange-100 mb-4">Our team is here to help. Reach out anytime.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="tel:+18448215610" className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors">
                <Phone className="w-5 h-5" />
                (844) 821-5610
              </a>
              <a href="mailto:claims@careclaims.com" className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors">
                <Mail className="w-5 h-5" />
                claims@careclaims.com
              </a>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-zinc-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Care Claims, Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;
