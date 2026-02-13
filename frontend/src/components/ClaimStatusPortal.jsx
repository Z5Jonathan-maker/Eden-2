import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Circle, Clock, FileText, Phone, Mail, MapPin, Calendar } from 'lucide-react';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

// Claim stages with descriptions
const STAGES = [
  { key: 'intake', label: 'Intake', description: 'Gathering claim information' },
  { key: 'inspection', label: 'Inspection', description: 'Documenting damage' },
  { key: 'negotiation', label: 'Negotiation', description: 'Working with carrier' },
  { key: 'settlement', label: 'Settlement', description: 'Finalizing paperwork' },
  { key: 'closed', label: 'Closed', description: 'Claim resolved' },
];

const ClaimStatusPortal = () => {
  const { claimId } = useParams();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchClaimStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/client-status/claim/${claimId}/public`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Claim not found. Please check your link.');
        } else {
          setError('Unable to load claim status.');
        }
        return;
      }

      const data = await res.json();
      setClaim(data);
    } catch (err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchClaimStatus();
  }, [fetchClaimStatus]);

  const getStageIndex = (stage) => {
    const idx = STAGES.findIndex((s) => s.key === stage);
    return idx >= 0 ? idx : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading claim status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Claim Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact Care Claims at{' '}
            <a href="tel:+18448215610" className="text-orange-600 font-medium">
              (844) 821-5610
            </a>
          </p>
        </div>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(claim?.stage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">CC</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Care Claims</h1>
                <p className="text-xs text-gray-500">Claim Status Portal</p>
              </div>
            </div>
            <a
              href="tel:+18448215610"
              className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">(844) 821-5610</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Claim Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Claim Number</p>
              <h2 className="text-2xl font-bold text-gray-900">{claim?.claim_number}</h2>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-700">
                {STAGES[currentStageIndex]?.label || 'Processing'}
              </span>
            </div>
          </div>

          {/* Client & Property Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-gray-500">Client</p>
                <p className="font-medium text-gray-900">{claim?.client_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-gray-500">Property</p>
                <p className="font-medium text-gray-900">{claim?.property_address}</p>
              </div>
            </div>
            {claim?.claim_type && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-500">Claim Type</p>
                  <p className="font-medium text-gray-900">{claim?.claim_type}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Claim Progress</h3>

          {/* Desktop Timeline */}
          <div className="hidden sm:block">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded">
                <div
                  className="h-full bg-orange-600 rounded transition-all duration-500"
                  style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
                />
              </div>

              {/* Stage Dots */}
              <div className="relative flex justify-between">
                {STAGES.map((stage, idx) => {
                  const isComplete = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div
                      key={stage.key}
                      className="flex flex-col items-center"
                      style={{ width: '20%' }}
                    >
                      <div
                        className={`
                        w-10 h-10 rounded-full flex items-center justify-center z-10
                        ${isComplete ? 'bg-orange-600' : isCurrent ? 'bg-orange-600 ring-4 ring-orange-200' : 'bg-gray-200'}
                      `}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-6 h-6 text-white" />
                        ) : isCurrent ? (
                          <Circle className="w-6 h-6 text-white fill-white" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <p
                        className={`mt-3 text-sm font-medium text-center ${isCurrent ? 'text-orange-600' : 'text-gray-600'}`}
                      >
                        {stage.label}
                      </p>
                      <p className="text-xs text-gray-500 text-center mt-1">{stage.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile Timeline */}
          <div className="sm:hidden space-y-4">
            {STAGES.map((stage, idx) => {
              const isComplete = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div key={stage.key} className="flex items-start gap-4">
                  <div
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${isComplete ? 'bg-orange-600' : isCurrent ? 'bg-orange-600 ring-2 ring-orange-200' : 'bg-gray-200'}
                  `}
                  >
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : isCurrent ? (
                      <Circle className="w-5 h-5 text-white fill-white" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 pb-4 border-b border-gray-100">
                    <p className={`font-medium ${isCurrent ? 'text-orange-600' : 'text-gray-900'}`}>
                      {stage.label}
                    </p>
                    <p className="text-sm text-gray-500">{stage.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Steps */}
        {(claim?.next_actions_client || claim?.next_actions_firm) && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">What's Happening</h3>

            <div className="space-y-4">
              {claim?.next_actions_firm && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-1">Our Team Is Working On:</p>
                  <p className="text-blue-700">{claim.next_actions_firm}</p>
                </div>
              )}

              {claim?.next_actions_client && (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-sm font-medium text-orange-800 mb-1">What You Can Do:</p>
                  <p className="text-orange-700">{claim.next_actions_client}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Card */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl shadow-lg p-6 text-white">
          <h3 className="text-lg font-bold mb-2">Questions About Your Claim?</h3>
          <p className="text-orange-100 mb-4">Our team is here to help. Reach out anytime.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="tel:+18448215610"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors"
            >
              <Phone className="w-5 h-5" />
              Call Us
            </a>
            <a
              href="mailto:claims@careclaims.com"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Email Us
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Care Claims, Inc. • Stewardship and Excellence
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Last updated:{' '}
            {claim?.last_client_update_at
              ? new Date(claim.last_client_update_at).toLocaleDateString()
              : 'Recently'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default ClaimStatusPortal;
