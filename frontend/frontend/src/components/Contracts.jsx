import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';
import { 
  FileCheck, Plus, Send, CheckCircle, Clock, Edit, Upload, Download, 
  X, FileText, User, Building, MapPin, Calendar, DollarSign, Loader2,
  ExternalLink, Eye, Trash2, Pen, Smartphone, RotateCcw, Target, ChevronRight
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { FEATURE_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ASSET_BASE = process.env.REACT_APP_ASSET_BASE_URL || '/assets/contracts';
const getToken = () => localStorage.getItem('eden_token');

const Contracts = () => {
  const [contracts, setContracts] = useState([]);
  const [stats, setStats] = useState({ total: 0, signed: 0, pending: 0, draft: 0 });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showInPersonDialog, setShowInPersonDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [signingInProgress, setSigningInProgress] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [claims, setClaims] = useState([]);
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [sendForm, setSendForm] = useState({ signer_email: '', signer_name: '', subject: '', message: '' });
  const [signatureData, setSignatureData] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const signatureCanvasRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      
      const [contractsRes, templatesRes, claimsRes] = await Promise.all([
        fetch(`${API_URL}/api/contracts/`, { headers }),
        fetch(`${API_URL}/api/contracts/templates`, { headers }),
        fetch(`${API_URL}/api/claims/`, { headers })
      ]);

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContracts(data.contracts || []);
        setStats(data.stats || { total: 0, signed: 0, pending: 0, draft: 0 });
      }
      
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }
      
      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setClaims(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
      toast.error('Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (templateId) => {
    try {
      const res = await fetch(`${API_URL}/api/contracts/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const template = await res.json();
        setSelectedTemplate(template);
        setFormValues({});
        setSelectedClaimId('');
        setShowCreateDialog(true);
      }
    } catch (err) {
      toast.error('Failed to load template');
    }
  };

  const handleClaimSelect = async (claimId) => {
    setSelectedClaimId(claimId);
    if (!claimId) return;

    try {
      const res = await fetch(`${API_URL}/api/contracts/prefill/${claimId}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setFormValues(prev => ({ ...prev, ...data.prefilled_values }));
        toast.success('Form pre-filled from claim data');
      }
    } catch (err) {
      console.error('Failed to prefill:', err);
    }
  };

  const handleCreateContract = async () => {
    if (!selectedTemplate) {
      toast.error('No template selected');
      return;
    }

    // Validate required fields
    const requiredFields = selectedTemplate.fields?.filter(f => f.required) || [];
    const missing = requiredFields.filter(f => !formValues[f.id]);
    
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setCreatingContract(true);
    try {
      const res = await fetch(`${API_URL}/api/contracts/`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          claim_id: selectedClaimId || null,
          client_name: formValues.policyholder_name || 'Unknown',
          client_email: formValues.policyholder_email || '',
          field_values: formValues
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Contract created successfully!');
        setShowCreateDialog(false);
        setSelectedTemplate(null);
        setFormValues({});
        fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || 'Failed to create contract');
      }
    } catch (err) {
      console.error('Contract creation error:', err);
      toast.error('Failed to create contract');
    } finally {
      setCreatingContract(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!selectedContract) return;

    try {
      const res = await fetch(`${API_URL}/api/contracts/${selectedContract.id}/send`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendForm)
      });

      const data = await res.json();
      
      if (data.status === 'signnow_not_configured') {
        toast.info('SignNow not configured - download the PDF and send manually');
      } else if (data.status === 'sent') {
        toast.success(`Contract sent to ${sendForm.signer_email}`);
        fetchData();
      } else {
        toast.info(data.message);
      }
      
      setShowSendDialog(false);
    } catch (err) {
      toast.error('Failed to send contract');
    }
  };

  const handleDownload = async (contract) => {
    try {
      // Try to get the filled PDF first
      const res = await fetch(`${API_URL}/api/contracts/${contract.id}/pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          // It's a PDF blob, download it
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contract_${contract.client_name?.replace(/\s/g, '_') || 'unknown'}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return;
        } else {
          // It's a JSON response with fallback URL
          const data = await res.json();
          if (data.pdf_url) {
            window.open(data.pdf_url, '_blank');
          }
        }
        } else {
          // Fallback to blank template (local asset path)
          window.open(`${ASSET_BASE}/Care_Claims_Contract_New.pdf`, '_blank');
        }
    } catch (err) {
      console.error('Download error:', err);
      // Fallback to template PDF (local asset path)
      window.open(`${ASSET_BASE}/Care_Claims_Contract_New.pdf`, '_blank');
    }
  };

  const handleDeleteContract = async (contractId) => {
    if (!window.confirm('Delete this contract?')) return;

    try {
      const res = await fetch(`${API_URL}/api/contracts/${contractId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      if (res.ok) {
        toast.success('Contract deleted');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete contract');
    }
  };

  // Sign On The Spot - In-Person Signing
  const handleSignInPerson = async (contract) => {
    setSelectedContract(contract);
    setSignatureData(null);
    setTermsAccepted(false);
    setShowInPersonDialog(true);
  };

  // Clear signature pad
  const clearSignature = () => {
    if (signatureCanvasRef.current) {
      signatureCanvasRef.current.clear();
      setSignatureData(null);
    }
  };

  // Handle signature end - capture the signature data
  const handleSignatureEnd = () => {
    if (signatureCanvasRef.current && !signatureCanvasRef.current.isEmpty()) {
      const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
      setSignatureData(dataUrl);
    }
  };

  // View contract details
  const handleViewContract = (contract) => {
    setSelectedContract(contract);
    setShowViewDialog(true);
  };

  // Complete in-person signing with signature
  const handleCompleteInPersonSigning = async () => {
    if (!selectedContract) return;
    
    // Check if signature is provided
    if (!signatureData) {
      toast.error('Please sign in the signature box');
      return;
    }
    
    if (!termsAccepted) {
      toast.error('Please accept the terms');
      return;
    }
    
    setSigningInProgress(true);
    
    try {
      const res = await fetch(`${API_URL}/api/contracts/${selectedContract.id}/complete-signing`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature_data: signatureData,
          signer_name: selectedContract.client_name,
          signed_in_person: true
        })
      });
      
      if (res.ok) {
        toast.success('Contract signed successfully!');
        fetchData();
        setShowInPersonDialog(false);
        setSelectedContract(null);
        setSignatureData(null);
        setTermsAccepted(false);
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to complete signing');
      }
    } catch (err) {
      console.error('Complete signing error:', err);
      toast.error('Failed to complete signing');
    } finally {
      setSigningInProgress(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'signed': 'badge-uncommon',
      'pending': 'badge-legendary',
      'in_person_pending': 'badge-rare',
      'draft': 'badge-common',
      'expired': 'badge-mythic'
    };
    return colors[status] || 'badge-common';
  };

  const getStatusIcon = (status) => {
    if (status === 'signed') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status === 'pending') return <Clock className="w-5 h-5 text-yellow-600" />;
    if (status === 'in_person_pending') return <Pen className="w-5 h-5 text-blue-600" />;
    return <FileCheck className="w-5 h-5 text-gray-600" />;
  };

  const renderFormField = (field) => {
    const value = formValues[field.id] || '';
    
    if (field.type === 'select') {
      return (
        <Select value={value} onValueChange={(v) => setFormValues(prev => ({ ...prev, [field.id]: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    if (field.type === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
          placeholder={field.label}
          rows={3}
        />
      );
    }
    
    return (
      <Input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
        placeholder={field.label}
        min={field.min}
        max={field.max}
      />
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading contracts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 min-h-screen page-enter">
      {/* Header - Tactical Style */}
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <img src={FEATURE_ICONS.contracts} alt="" className="w-6 h-6 sm:w-8 sm:h-8 object-contain badge-icon animate-float" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">CONTRACTS</h1>
          </div>
          <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">Digital signatures with automated tracking</p>
        </div>
        <div className="flex flex-shrink-0">
          <button 
            className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
            onClick={() => window.open(`${ASSET_BASE}/Care_Claims_Contract_New.pdf`, '_blank')}
          >
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>
      </div>

      {/* Stats - Tactical Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="card-tactical card-tactical-hover p-3 sm:p-5 group stagger-item">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">Total</span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-1">{stats.total}</p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">Contracts</p>
        </div>
        <div className="card-tactical card-tactical-hover p-3 sm:p-5 group stagger-item">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">Done</span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-green-400 mb-1">{stats.signed}</p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">Signed</p>
        </div>
        <div className="card-tactical card-tactical-hover p-3 sm:p-5 group stagger-item">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">Wait</span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-yellow-400 mb-1">{stats.pending}</p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">Pending</p>
        </div>
        <div className="card-tactical card-tactical-hover p-3 sm:p-5 group stagger-item">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">Draft</span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-zinc-400 mb-1">{stats.draft}</p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">Drafts</p>
        </div>
      </div>

      {/* Templates - Tactical Style */}
      <div className="card-tactical p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center gap-3 mb-5">
          <Target className="w-5 h-5 text-orange-500 animate-scale-pulse" />
          <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">Contract Templates</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Care Claims Template */}
          <div className="p-5 bg-zinc-800/30 rounded-lg border border-orange-500/30 hover:border-orange-500/50 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <FileCheck className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h4 className="font-tactical font-semibold text-white">Public Adjuster Agreement</h4>
                <p className="text-xs text-zinc-500 font-mono">Care Claims standard service agreement</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 font-mono mb-4">22 fields • FL compliant • E-signature ready</p>
            <button 
              className="btn-tactical w-full px-4 py-2.5 text-sm flex items-center justify-center gap-2"
              onClick={() => handleUseTemplate('care-claims-pa-agreement')}
              data-testid="use-pa-template-btn"
            >
              <Plus className="w-4 h-4" />
              Create Contract
            </button>
          </div>
          
          {/* DFS Disclosure (placeholder) */}
          <div className="p-5 bg-zinc-800/30 rounded-lg border border-zinc-700/30 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileCheck className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="font-tactical font-semibold text-white">DFS Disclosure Form</h4>
                <p className="text-xs text-zinc-500 font-mono">Department of Financial Services</p>
              </div>
            </div>
            <button 
              className="w-full px-4 py-2.5 rounded border border-zinc-700/50 text-zinc-500 font-mono text-xs uppercase cursor-not-allowed"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Contracts List - Tactical Style */}
      <div className="card-tactical p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">Active Contracts</h2>
          </div>
        </div>
        
        {contracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
              <FileText className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-tactical font-bold text-white mb-2 uppercase">No Contracts Yet</h3>
            <p className="text-zinc-500 mb-4 font-mono text-sm">Create your first contract from a template above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="p-4 md:p-5 bg-zinc-800/30 rounded-lg border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group"
                data-testid={`contract-${contract.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex-shrink-0">
                      {getStatusIcon(contract.status)}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-tactical font-semibold text-white truncate">{contract.template_name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${getStatusColor(contract.status)}`}>
                          {contract.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Client</p>
                          <p className="font-medium text-zinc-300 truncate">{contract.client_name}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Claim</p>
                          <p className="font-medium text-zinc-300 truncate">{contract.claim_id || 'N/A'}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Created</p>
                          <p className="font-medium text-zinc-300">
                            {new Date(contract.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:ml-4 justify-end sm:justify-start">
                    {/* View button */}
                    <button 
                      className="p-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all"
                      onClick={() => handleViewContract(contract)}
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    {contract.status === 'draft' && (
                      <>
                        <button 
                          className="px-3 py-2 rounded bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                          onClick={() => handleSignInPerson(contract)}
                          disabled={signingInProgress}
                          data-testid={`sign-in-person-${contract.id}`}
                        >
                          {signingInProgress ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pen className="w-4 h-4" />
                          )}
                          Sign Now
                        </button>
                        <button 
                          className="p-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                          onClick={() => {
                            setSelectedContract(contract);
                            setSendForm({
                              signer_email: contract.client_email || '',
                              signer_name: contract.client_name || '',
                              subject: `Please sign: ${contract.template_name}`,
                              message: ''
                            });
                            setShowSendDialog(true);
                          }}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                          onClick={() => handleDeleteContract(contract.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {contract.status === 'in_person_pending' && (
                      <button 
                        className="px-3 py-2 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                        onClick={() => {
                          setSelectedContract(contract);
                          setShowInPersonDialog(true);
                        }}
                      >
                        <Pen className="w-4 h-4" />
                        Continue
                      </button>
                    )}
                    {contract.status === 'pending' && (
                      <span className="px-2 py-1 rounded text-[10px] font-mono uppercase badge-legendary">Awaiting</span>
                    )}
                    {contract.status === 'signed' && (
                      <button 
                        className="px-3 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                        onClick={() => handleDownload(contract)}
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Contract Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contract: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Fill in the contract details. You can pre-fill from an existing claim.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-6 py-4">
              {/* Pre-fill from Claim */}
              <div className="bg-orange-50 rounded-lg p-4">
                <Label className="font-medium">Pre-fill from Claim (Optional)</Label>
                <Select value={selectedClaimId || "none"} onValueChange={(v) => handleClaimSelect(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a claim to pre-fill data..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None --</SelectItem>
                    {claims.slice(0, 50).map(claim => (
                      <SelectItem key={claim.id} value={claim.id}>
                        {claim.claim_number} - {claim.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Form Sections */}
              {selectedTemplate.sections?.map(section => (
                <div key={section.id} className="space-y-4">
                  <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                    {section.id === 'policyholder' && <User className="w-4 h-4" />}
                    {section.id === 'insurance' && <Building className="w-4 h-4" />}
                    {section.id === 'loss' && <MapPin className="w-4 h-4" />}
                    {section.id === 'fees' && <DollarSign className="w-4 h-4" />}
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedTemplate.fields
                      ?.filter(f => f.section === section.id)
                      .map(field => (
                        <div key={field.id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                          <Label className="text-sm">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {renderFormField(field)}
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creatingContract}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateContract} 
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={creatingContract}
                >
                  {creatingContract ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Create Contract
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send for Signature Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for E-Signature</DialogTitle>
            <DialogDescription>
              Send this contract to the client for electronic signature
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="signerName">Signer Name</Label>
              <Input 
                id="signerName" 
                value={sendForm.signer_name}
                onChange={(e) => setSendForm(prev => ({ ...prev, signer_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="signerEmail">Signer Email</Label>
              <Input 
                id="signerEmail" 
                type="email" 
                value={sendForm.signer_email}
                onChange={(e) => setSendForm(prev => ({ ...prev, signer_email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input 
                id="subject" 
                value={sendForm.subject}
                onChange={(e) => setSendForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea 
                id="message" 
                value={sendForm.message}
                onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Add a personal message..."
              />
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-3 text-sm">
              <p className="text-yellow-800">
                <strong>Note:</strong> SignNow integration required for e-signatures. 
                Configure your SignNow access token in Settings, or download and send manually.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open('https://customer-assets.emergentagent.com/job_eden-insurance/artifacts/2wnjf18n_Care%20Claims%20Contract%20New.pdf', '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                onClick={handleSendForSignature} 
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Contract
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-Person Signing Dialog */}
      <Dialog open={showInPersonDialog} onOpenChange={setShowInPersonDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pen className="w-5 h-5 text-green-600" />
              Sign On The Spot - Contract Review & Signature
            </DialogTitle>
            <DialogDescription>
              Review the contract details below and sign to complete
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {selectedContract && (
              <>
                {/* Contract Summary */}
                <div className="bg-orange-50 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-3">Contract: {selectedContract.template_name}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Client:</span>
                      <span className="ml-2 font-medium">{selectedContract.client_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{selectedContract.client_email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <span className="ml-2 font-medium">{new Date(selectedContract.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <Badge className={`ml-2 ${getStatusColor(selectedContract.status)}`}>{selectedContract.status}</Badge>
                    </div>
                  </div>
                </div>
                
                {/* Contract Field Values */}
                {selectedContract.field_values && Object.keys(selectedContract.field_values).length > 0 && (
                  <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/30">
                    <h4 className="font-tactical font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Contract Details
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {/* Policyholder Section */}
                      <div className="col-span-2 font-medium text-zinc-300 mt-2 mb-1 border-b border-zinc-700/30 pb-1">
                        <User className="w-4 h-4 inline mr-1 text-orange-500" />
                        Policyholder Information
                      </div>
                      {selectedContract.field_values.policyholder_name && (
                        <div><span className="text-zinc-500">Name:</span> <span className="font-medium text-white">{selectedContract.field_values.policyholder_name}</span></div>
                      )}
                      {selectedContract.field_values.policyholder_email && (
                        <div><span className="text-zinc-500">Email:</span> <span className="font-medium text-white">{selectedContract.field_values.policyholder_email}</span></div>
                      )}
                      {selectedContract.field_values.policyholder_address && (
                        <div><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedContract.field_values.policyholder_address}</span></div>
                      )}
                      {selectedContract.field_values.policyholder_phone && (
                        <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{selectedContract.field_values.policyholder_phone}</span></div>
                      )}
                      
                      {/* Insurance Section */}
                      <div className="col-span-2 font-medium text-gray-700 mt-3 mb-1 border-b pb-1">
                        <Building className="w-4 h-4 inline mr-1" />
                        Insurance Company
                      </div>
                      {selectedContract.field_values.insurance_company && (
                        <div><span className="text-gray-500">Company:</span> <span className="font-medium">{selectedContract.field_values.insurance_company}</span></div>
                      )}
                      {selectedContract.field_values.policy_number && (
                        <div><span className="text-gray-500">Policy #:</span> <span className="font-medium">{selectedContract.field_values.policy_number}</span></div>
                      )}
                      {selectedContract.field_values.claim_number && (
                        <div><span className="text-gray-500">Claim #:</span> <span className="font-medium">{selectedContract.field_values.claim_number}</span></div>
                      )}
                      
                      {/* Loss Section */}
                      <div className="col-span-2 font-medium text-gray-700 mt-3 mb-1 border-b pb-1">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Loss Location
                      </div>
                      {selectedContract.field_values.loss_address && (
                        <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{selectedContract.field_values.loss_address}</span></div>
                      )}
                      {selectedContract.field_values.date_of_loss && (
                        <div><span className="text-gray-500">Date of Loss:</span> <span className="font-medium">{selectedContract.field_values.date_of_loss}</span></div>
                      )}
                      {selectedContract.field_values.claim_type && (
                        <div><span className="text-gray-500">Claim Type:</span> <span className="font-medium">{selectedContract.field_values.claim_type}</span></div>
                      )}
                      {selectedContract.field_values.description_of_loss && (
                        <div className="col-span-2"><span className="text-gray-500">Description:</span> <span className="font-medium">{selectedContract.field_values.description_of_loss}</span></div>
                      )}
                      
                      {/* Fee Section */}
                      {selectedContract.field_values.fee_percentage && (
                        <>
                          <div className="col-span-2 font-medium text-gray-700 mt-3 mb-1 border-b pb-1">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            Fee Agreement
                          </div>
                          <div><span className="text-gray-500">Fee:</span> <span className="font-medium">{selectedContract.field_values.fee_percentage}%</span></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Download filled PDF button */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(selectedContract)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Filled PDF
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`${ASSET_BASE}/Care_Claims_Contract_New.pdf`, '_blank')}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Blank Template
                  </Button>
                </div>

                {/* Signature Pad Section */}
                <div className="bg-zinc-800/30 rounded-lg p-4 border-2 border-dashed border-orange-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-tactical font-semibold text-white flex items-center gap-2">
                      <Pen className="w-4 h-4 text-orange-500" />
                      Client Signature
                    </h4>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={clearSignature}
                      className="text-zinc-400 hover:text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  
                  <div className="bg-zinc-900/50 rounded-lg border border-zinc-700/30 overflow-hidden">
                    <SignatureCanvas
                      ref={signatureCanvasRef}
                      penColor="orange"
                      canvasProps={{
                        width: 500,
                        height: 150,
                        className: 'signature-canvas w-full touch-none',
                        style: { width: '100%', height: '150px', backgroundColor: '#18181b' }
                      }}
                      onEnd={handleSignatureEnd}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 text-center font-mono">
                    Sign above using your finger or stylus
                  </p>
                </div>

                {/* Agreement checkbox and Sign button */}
                <div className="border-t pt-4">
                  <label className="flex items-start gap-3 mb-4 cursor-pointer">
                    <input 
                      type="checkbox" 
                      id="agreeToTerms"
                      className="mt-1 w-5 h-5 rounded border-gray-300"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700">
                      I, <strong>{selectedContract.client_name}</strong>, acknowledge that I have read and understand the terms of this Public Adjuster Agreement. 
                      I agree to the fee structure and authorize Care Claims to represent me in my insurance claim.
                    </span>
                  </label>
                  
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setShowInPersonDialog(false);
                        setSelectedContract(null);
                        setSignatureData(null);
                        setTermsAccepted(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleCompleteInPersonSigning}
                      disabled={!termsAccepted || !signatureData || signingInProgress}
                      data-testid="complete-in-person-signing"
                    >
                      {signingInProgress ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Sign Contract
                    </Button>
                  </div>
                  
                  {!signatureData && termsAccepted && (
                    <p className="text-xs text-amber-600 mt-2 text-center">
                      Please sign in the signature box above
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Contract Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Template:</span>
                  <p className="font-medium">{selectedContract.template_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <Badge className={`ml-2 ${getStatusColor(selectedContract.status)}`}>{selectedContract.status}</Badge>
                </div>
                <div>
                  <span className="text-gray-500">Client:</span>
                  <p className="font-medium">{selectedContract.client_name}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Email:</span>
                  <p className="font-medium text-white">{selectedContract.client_email}</p>
                </div>
              </div>
              
              {selectedContract.field_values && (
                <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/30">
                  <h4 className="font-tactical font-medium mb-2 text-white">Field Values</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(selectedContract.field_values).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-zinc-500">{key.replace(/_/g, ' ')}:</span>
                        <span className="ml-1 font-medium text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50" onClick={() => handleDownload(selectedContract)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" className="flex-1 border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50" onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Features Info - Tactical Style */}
      <div className="card-tactical p-5 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex-shrink-0">
              <Pen className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="font-tactical font-semibold text-white mb-1">Sign On The Spot</h4>
              <p className="text-xs text-zinc-500 font-mono">In-person device signing</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h4 className="font-tactical font-semibold text-white mb-1">Digital Signatures</h4>
              <p className="text-xs text-zinc-500 font-mono">Legally binding e-signatures</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex-shrink-0">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h4 className="font-tactical font-semibold text-white mb-1">Auto Reminders</h4>
              <p className="text-xs text-zinc-500 font-mono">Automated follow-ups</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
              <FileCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-tactical font-semibold text-white mb-1">Template Library</h4>
              <p className="text-xs text-zinc-500 font-mono">Pre-built agreements</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contracts;
