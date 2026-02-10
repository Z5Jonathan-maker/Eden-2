import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import ApiService from '../services/ApiService';
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
  LogOut
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

  useEffect(() => {
    fetchClaimData();
  }, [claimId]);

  const fetchClaimData = async () => {
    try {
      setLoading(true);
      const [claimData, notesData, docsData] = await Promise.all([
        ApiService.getClaim(claimId),
        ApiService.getClaimNotes(claimId).catch(() => []),
        ApiService.getClaimDocuments(claimId).catch(() => [])
      ]);
      setClaim(claimData);
      setNotes(notesData);
      setDocuments(docsData);
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
      'New': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Under Review': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-green-100 text-green-800',
      'Closed': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusStep = (status) => {
    const steps = ['New', 'In Progress', 'Under Review', 'Completed'];
    return steps.indexOf(status) + 1;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-xl">E</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Eden Client Portal</h1>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-gray-600 mb-4">{error || 'Claim not found'}</p>
          <Button onClick={() => navigate('/client')} className="bg-orange-600 hover:bg-orange-700">
            Back to Portal
          </Button>
        </main>
      </div>
    );
  }

  const statusStep = getStatusStep(claim.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-bold text-xl">E</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Eden Client Portal</h1>
              <p className="text-sm text-gray-500">Claim Details</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
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
          className="mb-6"
          data-testid="back-to-portal"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to My Claims
        </Button>

        {/* Claim Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900" data-testid="claim-number">
                    {claim.claim_number}
                  </h2>
                  <Badge className={getStatusColor(claim.status)} data-testid="claim-status">
                    {claim.status}
                  </Badge>
                </div>
                <p className="text-gray-600">{claim.claim_type}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  ${(claim.estimated_value || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Estimated Value</p>
              </div>
            </div>

            {/* Progress Tracker */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-3">Claim Progress</p>
              <div className="flex items-center justify-between">
                {['New', 'In Progress', 'Under Review', 'Completed'].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      index < statusStep 
                        ? 'bg-green-500 text-gray-900' 
                        : index === statusStep - 1
                        ? 'bg-orange-500 text-gray-900'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {index < statusStep ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span className={`ml-2 text-sm ${
                      index < statusStep ? 'text-green-600 font-medium' : 'text-gray-500'
                    }`}>
                      {step}
                    </span>
                    {index < 3 && (
                      <div className={`w-12 h-1 mx-2 ${
                        index < statusStep - 1 ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Property Address</p>
                  <p className="font-medium text-gray-900">{claim.property_address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Date of Loss</p>
                  <p className="font-medium text-gray-900">{claim.date_of_loss}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileCheck className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Policy Number</p>
                  <p className="font-medium text-gray-900">{claim.policy_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Claim Handler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Assigned Adjuster</p>
                  <p className="font-medium text-gray-900">{claim.assigned_to || 'Pending Assignment'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="font-medium text-gray-900">{formatDate(claim.updated_at)}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-gray-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-500">Claim Filed</p>
                  <p className="font-medium text-gray-900">{formatDate(claim.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {claim.description && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Claim Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{claim.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Activity / Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Activity & Updates ({notes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No updates yet</p>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-gray-900">{note.author_name}</p>
                      <p className="text-xs text-gray-500">{formatDate(note.created_at)}</p>
                    </div>
                    <p className="text-gray-700">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No documents uploaded</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-6 h-6 text-orange-600" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.type} • {formatDate(doc.uploaded_at)}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Download</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>© 2024 Eden Claims Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientClaimDetails;
