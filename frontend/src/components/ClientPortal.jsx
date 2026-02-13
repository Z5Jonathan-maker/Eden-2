import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import ApiService from '../services/ApiService';
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
      const data = await ApiService.getClaims();
      setClaims(data);
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
      New: 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Under Review': 'bg-purple-100 text-purple-800',
      Completed: 'bg-green-100 text-green-800',
      Closed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  const stats = {
    total: claims.length,
    active: claims.filter((c) => !['Completed', 'Closed'].includes(c.status)).length,
    completed: claims.filter((c) => c.status === 'Completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-bold text-xl">E</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Eden Client Portal</h1>
              <p className="text-sm text-gray-500">Track your claims</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span data-testid="client-name">{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="client-logout">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h2>
          <p className="text-gray-600">Here's the status of your insurance claims</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card data-testid="stat-total">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Claims</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <FolderOpen className="w-10 h-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-active">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Claims</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.active}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-completed">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Center Quick Access */}
        <Card className="mb-6 bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-200 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Client Resource Center</h3>
                  <p className="text-sm text-gray-600">
                    Learn about your claim, timelines, and FAQs
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/client/learn')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Claims</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchClaims}
                data-testid="refresh-claims"
              >
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

            {claims.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No claims found</p>
                <p className="text-sm text-gray-600">Contact us if you believe this is an error</p>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedClaim?.id === claim.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedClaim(selectedClaim?.id === claim.id ? null : claim)}
                    data-testid={`client-claim-${claim.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        {getStatusIcon(claim.status)}
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-gray-900">{claim.claim_number}</span>
                            <Badge className={getStatusColor(claim.status)}>{claim.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{claim.claim_type}</p>
                          <p className="text-sm text-gray-500">{claim.property_address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${(claim.estimated_value || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Estimated Value</p>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedClaim?.id === claim.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Date of Loss</p>
                            <p className="font-medium text-gray-900">{claim.date_of_loss}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Policy Number</p>
                            <p className="font-medium text-gray-900">{claim.policy_number}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Assigned Adjuster</p>
                            <p className="font-medium text-gray-900">
                              {claim.assigned_to || 'Pending Assignment'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Last Updated</p>
                            <p className="font-medium text-gray-900">
                              {formatDate(claim.updated_at)}
                            </p>
                          </div>
                        </div>
                        {claim.description && (
                          <div className="mt-4">
                            <p className="text-gray-500 text-sm">Description</p>
                            <p className="text-gray-900 mt-1">{claim.description}</p>
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
                            View Details
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              If you have questions about your claim or need assistance, please contact us:
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <Phone className="w-5 h-5 text-orange-600" />
                <span>(555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <Mail className="w-5 h-5 text-orange-600" />
                <span>support@eden-claims.com</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>© 2024 Eden Claims Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;
