import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import {
  Zap,
  Send,
  Sparkles,
  FileText,
  TrendingUp,
  AlertCircle,
  Plus,
  History,
  Trash2,
  Link,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Upload,
  File,
  Loader2,
  Cpu,
  Copy,
  Check,
} from 'lucide-react';
import { FEATURE_ICONS, PAGE_ICONS } from '../../../assets/badges';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete, API_URL } from '../../../lib/api';

// Lightweight markdown renderer — handles bold, inline code, and list items
const renderMarkdown = (text) => {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-zinc-700/60 text-orange-300 rounded text-xs">$1</code>')
    .replace(/^[•\-]\s+(.+)$/gm, '<div class="flex items-start gap-2 ml-2"><span class="text-orange-500 mt-1 shrink-0">&#8226;</span><span>$1</span></div>')
    .replace(/\n/g, '<br />');
};

// Fallback model list in case backend /api/ai/models is unreachable
const FALLBACK_MODELS = [
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', size: '671B', description: 'Powerful reasoning model with chain-of-thought', recommended: true },
  { id: 'gemma3:27b', name: 'Gemma 3 27B', size: '27B', description: "Google's balanced model — good quality, fast" },
  { id: 'gemma3:12b', name: 'Gemma 3 12B', size: '12B', description: 'Fastest general-purpose model' },
  { id: 'qwen3.5:397b', name: 'Qwen 3.5', size: '397B', description: "Alibaba's latest large model" },
  { id: 'mistral-large-3:675b', name: 'Mistral Large 3', size: '675B', description: "Mistral's flagship model" },
  { id: 'deepseek-v3.1:671b', name: 'DeepSeek V3.1', size: '671B', description: 'Previous DeepSeek version' },
  { id: 'gemma3:4b', name: 'Gemma 3 4B', size: '4B', description: 'Ultra-fast lightweight model' },
  { id: 'ministral-3:8b', name: 'Ministral 3 8B', size: '8B', description: "Mistral's small efficient model" },
];

const EveAI = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I\'m **Agent Eve**, your AI property intelligence officer AI Powered. I can help you analyze insurance policies, compare estimates, build claim strategies, and provide expert tactical guidance.\n\n**Tip:** Reference any claim by typing #claim-number (e.g., #12345) or use "Link Claim" to select one. How can I assist with your mission today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Claim linking state
  const [linkedClaim, setLinkedClaim] = useState(null);
  const [showClaimSelector, setShowClaimSelector] = useState(false);
  const [claimSearch, setClaimSearch] = useState('');
  const [availableClaims, setAvailableClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Model selector state — initialize with fallback so dropdown is never empty
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODELS.find((m) => m.id === 'gemma3:12b') || FALLBACK_MODELS[0]);
  const [availableModels, setAvailableModels] = useState(FALLBACK_MODELS);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const modelSelectorRef = useRef(null);

  // Document upload state
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch existing sessions and available models on mount
  useEffect(() => {
    fetchSessions();
    fetchModels();
  }, []);

  // Close model selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target)) {
        setShowModelSelector(false);
      }
    };
    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelSelector]);

  const fetchModels = async () => {
    try {
      const response = await apiGet('/api/ai/models');
      if (response.ok && response.data?.models?.length) {
        const models = response.data.models;
        setAvailableModels(models);
        const defaultId = response.data.default_model;
        const defaultModel = models.find((m) => m.id === defaultId) || models[0];
        if (defaultModel) {
          setSelectedModel(defaultModel);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models (using fallback list):', error);
    }
  };

  // Fetch claims when search changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (showClaimSelector) {
        fetchClaims(claimSearch);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [claimSearch, showClaimSelector]);

  const fetchClaims = async (search = '') => {
    try {
      setLoadingClaims(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await apiGet(`/api/ai/claims-for-context${params}`);
      if (response.ok) {
        setAvailableClaims(response.data.claims || []);
      }
    } catch (error) {
      console.error('Failed to fetch claims:', error);
    } finally {
      setLoadingClaims(false);
    }
  };

  const linkClaim = async (claim) => {
    try {
      const response = await apiGet(`/api/ai/claim-context/${claim.id}`);
      if (response.ok) {
        setLinkedClaim(response.data);
        setShowClaimSelector(false);
        setClaimSearch('');

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**Claim #${response.data.claim_number} linked**\n\nClient: ${response.data.client_name}\nStatus: ${response.data.status}\nCarrier: ${response.data.carrier || 'N/A'}\n\nI now have full access to this claim's details, notes, and documents. Ask me anything about it!`,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to link claim:', error);
    }
  };

  const unlinkClaim = () => {
    setLinkedClaim(null);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content:
          "Claim unlinked. I'll no longer reference specific claim data unless you mention a claim number or link another one.",
      },
    ]);
  };

  // Document upload handler
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadedFiles = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await apiPost('/api/ai/upload-document', formData);

        if (response.ok) {
          uploadedFiles.push({
            id: response.data.document_id || Date.now(),
            name: file.name,
            type: file.type,
            extracted_text: response.data.extracted_text || null,
            size: file.size,
          });
        } else {
          toast.error(`Failed to upload: ${file.name}`);
        }
      }

      if (uploadedFiles.length > 0) {
        setUploadedDocs((prev) => [...prev, ...uploadedFiles]);

        const docNames = uploadedFiles.map((d) => d.name).join(', ');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**Document${uploadedFiles.length > 1 ? 's' : ''} uploaded:** ${docNames}\n\nI'm ready to analyze ${uploadedFiles.length > 1 ? 'these documents' : 'this document'}. What would you like me to help you with?\n\n**Suggestions:**\n- "Summarize the key points"\n- "What coverage does this policy provide?"\n- "Compare this to the carrier estimate"\n- "Find any discrepancies or issues"`,
          },
        ]);

        toast.success(
          `${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''} uploaded`
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload documents');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedDoc = (docId) => {
    setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  const fetchSessions = async () => {
    try {
      const response = await apiGet('/api/ai/sessions');
      if (response.ok) {
        setSessions(response.data.sessions || []);
      }
    } catch (error) {
      // Silently fail - sessions will load when user interacts
    }
  };

  const loadSession = async (sid) => {
    try {
      const response = await apiGet(`/api/ai/sessions/${sid}`);
      if (response.ok) {
        setSessionId(sid);
        setMessages([
          {
            role: 'assistant',
            content:
              "Hello! I'm Eve, your AI property intelligence assistant AI Powered. I can help you analyze insurance policies, compare estimates, build claim strategies, and provide expert guidance on your claims. How can I assist you today?",
          },
          ...(response.data.messages || []),
        ]);
        setShowSessions(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSession = async (sid, e) => {
    e.stopPropagation();
    try {
      await apiDelete(`/api/ai/sessions/${sid}`);
      fetchSessions();
      if (sessionId === sid) {
        startNewSession();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const startNewSession = () => {
    setSessionId(null);
    setLinkedClaim(null);
    setMessages([
      {
        role: 'assistant',
        content:
          'Hello! I\'m Eve, your AI property intelligence assistant AI Powered. I can help you analyze insurance policies, compare estimates, build claim strategies, and provide expert guidance on your claims.\n\n**Tip:** You can reference any claim by typing #claim-number (e.g., #12345) or use the "Link Claim" button to select one. How can I assist you today?',
      },
    ]);
    setShowSessions(false);
  };

  // Context-aware quick actions
  const quickActions = useMemo(() => {
    const I = (Icon) => <Icon className="w-4 h-4" />;
    const actions = [
      { icon: I(FileText), label: 'Analyze Policy', prompt: 'Help me analyze an insurance policy. What information do you need from me?' },
    ];
    if (uploadedDocs.length > 0) {
      actions.push(
        { icon: I(FileText), label: 'Summarize Document', prompt: 'Summarize the key points of the uploaded document(s).' },
        { icon: I(Search), label: 'Find Coverage Gaps', prompt: 'Analyze the uploaded documents for any coverage gaps or issues.' },
      );
    }
    if (linkedClaim) {
      const cn = linkedClaim.claim_number;
      actions.push(
        { icon: I(TrendingUp), label: 'Claim Strategy', prompt: `What's the best strategy for claim #${cn}? Consider the current status and carrier.` },
        { icon: I(Sparkles), label: 'Write Supplement', prompt: `Help me write a supplement for claim #${cn}. What additional items should we request?` },
        { icon: I(AlertCircle), label: 'Settlement Range', prompt: `What's a realistic settlement range for claim #${cn}?` },
      );
    } else {
      actions.push(
        { icon: I(TrendingUp), label: 'Compare Estimates', prompt: 'I need to compare a carrier estimate with a contractor estimate. Can you walk me through the key areas to focus on?' },
        { icon: I(Sparkles), label: 'Claim Strategy', prompt: 'Help me develop a claim strategy. What information do you need about the claim?' },
      );
    }
    actions.push({ icon: I(Sparkles), label: 'Coverage Question', prompt: "What's typically covered for wind and hail damage?" });
    return actions;
  }, [linkedClaim, uploadedDocs]);

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = messageText.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsAnalyzing(true);

    try {
      const requestBody = {
        message: userMessage,
        session_id: sessionId,
      };

      if (selectedModel) {
        requestBody.model = selectedModel.id;
        requestBody.provider = 'ollama';
      }

      if (linkedClaim) {
        requestBody.claim_id = linkedClaim.claim_id;
      }

      if (uploadedDocs.length > 0) {
        requestBody.document_ids = uploadedDocs.map((d) => d.id);
        requestBody.document_names = uploadedDocs.map((d) => d.name);
      }

      const response = await apiPost('/api/ai/chat', requestBody);

      if (!response.ok) {
        throw new Error(response.error?.detail || response.error || 'Failed to get response');
      }

      const data = response.data;

      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
        fetchSessions();
      }

      if (data.claim_context && !linkedClaim) {
        setLinkedClaim(data.claim_context);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Eve AI error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I apologize, but I encountered an error: ${error.message}. Please try again or contact support if the issue persists.`,
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleQuickAction = (prompt) => {
    sendMessage(prompt);
  };

  // Capabilities with availability status
  const capabilities = useMemo(() => [
    { label: 'Policy analysis & coverage interpretation', available: true },
    { label: 'Line-by-line estimate comparison', available: true },
    { label: 'Claim strategy & negotiation tactics', available: !!linkedClaim },
    { label: 'Supplement writing assistance', available: !!linkedClaim },
    { label: 'Florida insurance regulations (627.70131)', available: true },
    { label: 'IICRC standards (S500, S520)', available: true },
  ], [linkedClaim]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter">
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4 mb-2">
            <img
              src={PAGE_ICONS.eve_ai}
              alt="Agent Eve"
              width={64}
              height={64}
              className="w-16 h-16 object-contain badge-icon animate-glow-breathe"
              style={{ filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))' }}
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-blue">
                AGENT EVE
              </h1>
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
                AI Intelligence Officer • {selectedModel ? selectedModel.name : 'AI'} Powered
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="px-4 py-2 rounded border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-sm font-mono uppercase flex items-center gap-2 hover:border-orange-500/30 hover:text-orange-400 transition-all"
              data-testid="history-btn"
            >
              <History className="w-4 h-4" />
              Intel Log
            </button>
            <button
              onClick={startNewSession}
              className="btn-tactical px-4 py-2 text-sm flex items-center gap-2"
              data-testid="new-chat-btn"
            >
              <Plus className="w-4 h-4" />
              New Mission
            </button>
          </div>
        </div>

        {/* Linked Claim Banner - Tactical */}
        {linkedClaim && (
          <div className="mt-4 card-tactical p-3 border-l-2 border-blue-500 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <span className="font-tactical font-semibold text-blue-400">
                  Linked Target: #{linkedClaim.claim_number}
                </span>
                <span className="text-zinc-500 ml-2 font-mono text-sm">
                  • {linkedClaim.client_name} • {linkedClaim.status}
                </span>
              </div>
            </div>
            <button
              onClick={unlinkClaim}
              className="text-zinc-500 hover:text-red-400 flex items-center gap-1 text-sm font-mono uppercase transition-colors"
            >
              <X className="w-4 h-4" />
              Unlink
            </button>
          </div>
        )}

      </div>

      {/* Claim Selector Modal - Tactical */}
      {showClaimSelector && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowClaimSelector(false)}
        >
          <div
            className="card-tactical max-w-lg w-full max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-700/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">
                  Link Target
                </h3>
                <button
                  onClick={() => setShowClaimSelector(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  placeholder="Search by claim #, client name, or address..."
                  value={claimSearch}
                  onChange={(e) => setClaimSearch(e.target.value)}
                  className="input-tactical w-full pl-10 py-2"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {loadingClaims ? (
                <div className="text-center py-8 text-zinc-400">Loading claims...</div>
              ) : availableClaims.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">
                  {claimSearch ? 'No claims found matching your search' : 'No claims available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableClaims.map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => linkClaim(claim)}
                      className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 border border-zinc-700/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-tactical font-semibold text-orange-400">
                            #{claim.claim_number}
                          </span>
                          <span className="text-zinc-400 ml-2 font-mono text-sm">
                            {claim.client_name}
                          </span>
                        </div>
                        <Badge
                          variant={claim.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {claim.status}
                        </Badge>
                      </div>
                      {claim.property_address && (
                        <p className="text-sm text-zinc-500 mt-1 truncate font-mono">
                          {claim.property_address}
                        </p>
                      )}
                      {claim.carrier && (
                        <p className="text-xs text-zinc-500 mt-1 font-mono">
                          Carrier: {claim.carrier}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Quick Actions Sidebar - Tactical */}
        <div className="lg:col-span-1 space-y-4">
          {/* Sessions Panel */}
          {showSessions && (
            <div className="card-tactical p-4 mb-4 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-orange-500" />
                <h3 className="font-tactical font-bold text-white text-sm uppercase tracking-wide">
                  Intel Log
                </h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="text-sm text-zinc-500 font-mono">No previous missions</p>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.session_id}
                      onClick={() => loadSession(session.session_id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between group transition-all ${
                        sessionId === session.session_id
                          ? 'bg-orange-500/20 border border-orange-500/30'
                          : 'hover:bg-zinc-800 border border-transparent'
                      }`}
                    >
                      <span className="text-sm text-zinc-300 font-mono truncate">
                        {new Date(session.updated_at || session.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => deleteSession(session.session_id, e)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="card-tactical p-4 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-orange-500 animate-bounce-gentle" />
              <h3 className="font-tactical font-bold text-white text-sm uppercase tracking-wide">
                Quick Actions
              </h3>
            </div>
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  className="w-full text-left p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800 transition-all duration-200 group"
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={isAnalyzing}
                  data-testid={`quick-action-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 group-hover:animate-bounce-gentle">
                      {action.icon}
                    </span>
                    <span className="text-sm text-zinc-300 group-hover:text-white font-mono transition-colors">
                      {action.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card-tactical p-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-400 animate-scale-pulse" />
              <h3 className="font-tactical font-bold text-white text-sm uppercase tracking-wide">
                Capabilities
              </h3>
            </div>
            <div className="space-y-2.5">
              {capabilities.map((cap, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${cap.available ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <p className={`text-xs font-mono ${cap.available ? 'text-zinc-400' : 'text-zinc-500'}`}>{cap.label}</p>
                </div>
              ))}
            </div>
            {!linkedClaim && (
              <p className="text-[10px] text-yellow-500/70 font-mono mt-3 border-t border-zinc-700/30 pt-2">
                Link a claim to unlock more capabilities
              </p>
            )}
          </div>
        </div>

        {/* Chat Interface - Tactical */}
        <div className="lg:col-span-3">
          <div className="card-tactical h-[calc(100vh-200px)] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={FEATURE_ICONS.agent_eve} alt="Agent Eve" width={24} height={24} className="w-6 h-6 object-contain" />
                <h3 className="font-tactical font-bold text-white text-sm uppercase tracking-wide">
                  Conversation
                </h3>
              </div>
              <div className="relative" ref={modelSelectorRef}>
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full hover:border-green-400/50 transition-colors cursor-pointer"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <Cpu className="w-3 h-3 text-green-400" />
                  <span className="text-green-400 text-xs font-mono">
                    {selectedModel ? selectedModel.name : 'Select Model'}
                  </span>
                  {showModelSelector ? (
                    <ChevronUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-green-400" />
                  )}
                </button>

                {showModelSelector && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-zinc-700/50">
                      <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider px-2">
                        AI Models
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {availableModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model);
                            setShowModelSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                            selectedModel?.id === model.id
                              ? 'bg-orange-500/20 border border-orange-500/30'
                              : 'hover:bg-zinc-800 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-200 font-mono">{model.name}</span>
                            <div className="flex items-center gap-2">
                              {model.recommended && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded font-mono">
                                  TOP
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500 font-mono">{model.size}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5 font-mono">{model.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
              data-testid="chat-messages"
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-3 max-w-2xl ${
                      message.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user'
                          ? 'bg-orange-500'
                          : 'bg-gradient-to-br from-orange-500 to-red-500'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <span className="text-zinc-900 text-xs font-tactical font-bold">You</span>
                      ) : (
                        <Zap className="w-4 h-4 text-zinc-900" />
                      )}
                    </div>
                    <div className="relative group">
                      <div
                        className={`rounded-lg p-3 sm:p-4 ${
                          message.role === 'user'
                            ? 'bg-orange-500/20 border border-orange-500/30 text-zinc-200'
                            : 'bg-zinc-800 border border-zinc-700/30 text-zinc-300'
                        }`}
                      >
                        <div
                          className="text-sm font-mono leading-relaxed [&_strong]:text-white [&_strong]:font-semibold [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-zinc-700/60 [&_code]:text-orange-300 [&_code]:rounded [&_code]:text-xs"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        />
                      </div>
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => copyMessage(message.content, index)}
                          className="absolute -bottom-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded bg-zinc-700/80 border border-zinc-600/50 hover:bg-zinc-600/80 text-zinc-400 hover:text-white"
                          title="Copy message"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isAnalyzing && (
                <div className="flex justify-start animate-fade-in-up">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-zinc-900" />
                    </div>
                    <div className="bg-zinc-800 border border-zinc-700/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono animate-pulse">
                          Eve is analyzing...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-700/50 p-4">
              {/* Uploaded Documents Display */}
              {uploadedDocs.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 text-xs font-mono"
                    >
                      <File className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{doc.name}</span>
                      <button
                        onClick={() => removeUploadedDoc(doc.id)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex space-x-3">
                {/* Document Upload Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`shrink-0 p-2.5 rounded border ${uploadedDocs.length > 0 ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-zinc-700/50 text-zinc-400 hover:text-purple-400 hover:border-purple-500/30'} transition-all`}
                  title="Upload documents for analysis"
                  data-testid="upload-doc-btn"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </button>

                {/* Link Claim Button */}
                <button
                  onClick={() => {
                    setShowClaimSelector(true);
                    fetchClaims('');
                  }}
                  className={`shrink-0 p-2.5 rounded border ${linkedClaim ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : 'border-zinc-700/50 text-zinc-400 hover:text-blue-400 hover:border-blue-500/30'} transition-all`}
                  title={linkedClaim ? `Linked: #${linkedClaim.claim_number}` : 'Link a claim'}
                  data-testid="link-claim-btn"
                >
                  <Link className="w-4 h-4" />
                </button>

                <input
                  placeholder={
                    linkedClaim
                      ? `Ask about claim #${linkedClaim.claim_number}...`
                      : uploadedDocs.length > 0
                        ? 'Ask about the uploaded documents...'
                        : 'Ask Agent Eve anything about your claims...'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isAnalyzing && handleSend()}
                  className="flex-1 input-tactical px-4 py-2.5"
                  disabled={isAnalyzing}
                  data-testid="chat-input"
                />
                <button
                  onClick={handleSend}
                  className="btn-tactical px-4 py-2.5"
                  disabled={isAnalyzing || !input.trim()}
                  data-testid="send-btn"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2 font-mono">
                Upload documents (PDF, images, Word) | Link claims with # or the link button
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EveAI;
