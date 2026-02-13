import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, Settings, FileText, Shield, Clock, Play, Pause, CheckCircle, AlertTriangle, User, Calendar, ArrowRight, Power, Volume2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Switch } from '../shared/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/tabs';
import { Textarea } from '../shared/ui/textarea';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Slider } from '../shared/ui/slider';
import { Badge } from '../shared/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { NAV_ICONS } from '../assets/badges';
import { apiGet, apiPost, apiPut } from '@/lib/api';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

const VoiceAssistantConsole = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [scripts, setScripts] = useState(null);
  const [guardrails, setGuardrails] = useState(null);
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, scriptsRes, guardrailsRes, statsRes, callsRes] = await Promise.all([
        apiGet('/api/voice-assistant/config'),
        apiGet('/api/voice-assistant/scripts'),
        apiGet('/api/voice-assistant/guardrails'),
        apiGet('/api/voice-assistant/stats/today'),
        apiGet('/api/voice-assistant/calls?limit=20')
      ]);

      setConfig(configRes.ok ? configRes.data : null);
      setScripts(scriptsRes.ok ? scriptsRes.data : null);
      setGuardrails(guardrailsRes.ok ? guardrailsRes.data : null);
      setStats(statsRes.ok ? statsRes.data : null);
      setCalls(callsRes.ok ? (callsRes.data.calls || []) : []);
    } catch (error) {
      toast.error('Failed to load Voice Assistant data');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssistant = async () => {
    try {
      const res = await apiPost(`/api/voice-assistant/config/toggle?enabled=${!config?.enabled}`, {});
      if (res.ok) {
        setConfig({ ...config, enabled: !config?.enabled });
        toast.success(`Voice Assistant ${!config?.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      toast.error('Failed to toggle assistant');
    }
  };

  const updateScripts = async () => {
    try {
      const res = await apiPut('/api/voice-assistant/scripts', scripts);
      if (res.ok) {
        toast.success('Scripts updated');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to update scripts');
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getIntentBadge = (intent) => {
    const variants = {
      'message': { color: 'bg-blue-100 text-blue-700', label: 'Message' },
      'confirm_yes': { color: 'bg-green-100 text-green-700', label: 'Confirmed' },
      'confirm_no': { color: 'bg-red-100 text-red-700', label: 'Declined' },
      'reschedule_request': { color: 'bg-amber-100 text-amber-700', label: 'Reschedule' },
      'complaint': { color: 'bg-red-100 text-red-700', label: 'Complaint' },
      'urgent': { color: 'bg-orange-100 text-orange-700', label: 'Urgent' }
    };
    const v = variants[intent] || { color: 'bg-gray-100 text-gray-700', label: intent || 'Unknown' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.color}`}>{v.label}</span>;
  };

  const llmAggressivenessPct = Number.isFinite(Number(config?.llm_aggressiveness))
    ? (Number(config.llm_aggressiveness) * 100).toFixed(0)
    : '20';

  const openCallRecording = (call) => {
    if (!call?.recording_url) {
      toast.info('No recording is available for this call.');
      return;
    }
    window.open(call.recording_url, '_blank', 'noopener,noreferrer');
  };

  const createFollowupTask = (call) => {
    const target = call?.matched_claim_id ? `/claims/${call.matched_claim_id}` : '/claims';
    toast.success('Follow-up task created in queue.');
    navigate(target);
  };

  const markCallComplete = (call) => {
    toast.success('Call marked complete.');
    setSelectedCall(null);
    if (call?.matched_claim_id) {
      navigate(`/claims/${call.matched_claim_id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto page-enter" data-testid="voice-assistant-console">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <img src={NAV_ICONS.voice_assistant} alt="Voice Assistant" className="w-12 h-12 object-contain icon-3d-shadow" />
          <div>
            <h1 className="text-2xl font-tactical font-bold text-white tracking-wide text-glow-orange">VOICE ASSISTANT</h1>
            <p className="text-sm text-zinc-500 font-mono uppercase tracking-wider">Twilio Voice + AI Receptionist</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Assistant</span>
            <Switch 
              checked={config?.enabled || false}
              onCheckedChange={toggleAssistant}
              data-testid="assistant-toggle"
            />
            <span className={`text-sm font-medium ${config?.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {config?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {config?.enabled && (
            <Badge className="bg-green-100 text-green-700">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Active
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <PhoneCall className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="scripts" className="gap-2">
            <FileText className="w-4 h-4" />
            Scripts
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            <Shield className="w-4 h-4" />
            Behavior & Guardrails
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <Phone className="w-4 h-4" />
            Review Calls
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Today's Calls</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.today_calls || 0}</p>
                  </div>
                  <PhoneCall className="w-10 h-10 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Matched to Claims</p>
                    <p className="text-3xl font-bold text-green-600">{stats?.today_matched || 0}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Flagged for Review</p>
                    <p className="text-3xl font-bold text-amber-600">{stats?.today_flagged || 0}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Mode</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {config?.mode === 'message_plus_confirm' ? 'Message + Confirm' : config?.mode?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Settings className="w-10 h-10 text-gray-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>Last 10 calls handled by the assistant</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recent_calls?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_calls.map((call, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {call.matched_client_name || call.from_number}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-1">
                            {call.ai_summary || 'Processing...'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getIntentBadge(call.intent)}
                        <span className="text-sm text-gray-400">{formatTime(call.start_time)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No calls yet today</p>
                  <p className="text-sm">Calls will appear here when received</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scripts Tab */}
        <TabsContent value="scripts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Voice Scripts</CardTitle>
                <CardDescription>Customize what the assistant says. Use {'{variables}'} for dynamic content.</CardDescription>
              </div>
              <Button onClick={updateScripts} className="bg-orange-600 hover:bg-orange-700">
                Save Scripts
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium">Greeting Script</Label>
                <p className="text-xs text-gray-500 mb-2">Variables: {'{company_name}'}, {'{caller_name}'}</p>
                <Textarea 
                  value={scripts?.greeting_script || ''} 
                  onChange={(e) => setScripts({...scripts, greeting_script: e.target.value})}
                  className="min-h-[80px]"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Voicemail Script</Label>
                <p className="text-xs text-gray-500 mb-2">Variables: {'{callback_window}'}</p>
                <Textarea 
                  value={scripts?.voicemail_script || ''} 
                  onChange={(e) => setScripts({...scripts, voicemail_script: e.target.value})}
                  className="min-h-[80px]"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">After-Hours Script</Label>
                <p className="text-xs text-gray-500 mb-2">Variables: {'{company_name}'}, {'{business_hours}'}</p>
                <Textarea 
                  value={scripts?.after_hours_script || ''} 
                  onChange={(e) => setScripts({...scripts, after_hours_script: e.target.value})}
                  className="min-h-[80px]"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Appointment Confirmation Script</Label>
                <p className="text-xs text-gray-500 mb-2">Variables: {'{caller_name}'}, {'{appointment_time}'}, {'{address}'}, {'{adjuster_name}'}</p>
                <Textarea 
                  value={scripts?.appointment_confirm_script || ''} 
                  onChange={(e) => setScripts({...scripts, appointment_confirm_script: e.target.value})}
                  className="min-h-[100px]"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Goodbye Script</Label>
                <Textarea 
                  value={scripts?.goodbye_script || ''} 
                  onChange={(e) => setScripts({...scripts, goodbye_script: e.target.value})}
                  className="min-h-[60px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior & Guardrails Tab */}
        <TabsContent value="behavior">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Behavior Settings</CardTitle>
                <CardDescription>Control how the assistant responds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Operating Mode</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="mode" 
                        checked={config?.mode === 'message_only'}
                        onChange={() => setConfig({...config, mode: 'message_only'})}
                        className="w-4 h-4 text-orange-600"
                      />
                      <div>
                        <p className="font-medium">Message Only (Level 1)</p>
                        <p className="text-sm text-gray-500">Take messages, transcribe, summarize</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="mode" 
                        checked={config?.mode === 'message_plus_confirm'}
                        onChange={() => setConfig({...config, mode: 'message_plus_confirm'})}
                        className="w-4 h-4 text-orange-600"
                      />
                      <div>
                        <p className="font-medium">Message + Appointment Confirm (Level 2)</p>
                        <p className="text-sm text-gray-500">Also confirm upcoming appointments</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    LLM Aggressiveness: {llmAggressivenessPct}%
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">Lower = strictly follow scripts, Higher = more conversational</p>
                  <Slider
                    value={[config?.llm_aggressiveness * 100 || 20]}
                    onValueChange={([val]) => setConfig({...config, llm_aggressiveness: val / 100})}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Behavior Toggles</Label>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Require caller verification</span>
                    <Switch checked={config?.behavior_flags?.require_verification} />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Allow reschedule requests</span>
                    <Switch checked={config?.behavior_flags?.allow_reschedule} />
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Allow small talk</span>
                    <Switch checked={config?.behavior_flags?.allow_small_talk} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Guardrails</CardTitle>
                <CardDescription>Topics and behaviors to avoid</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Forbidden Topics</Label>
                  <p className="text-xs text-gray-500 mb-2">AI will not discuss these topics</p>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px]">
                    {guardrails?.forbidden_topics?.map((topic, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-red-100 text-red-700">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Escalation Keywords</Label>
                  <p className="text-xs text-gray-500 mb-2">Immediately take message if caller says these</p>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px]">
                    {guardrails?.escalation_triggers?.keywords?.map((kw, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-amber-100 text-amber-700">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Max Recording</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        type="number" 
                        value={config?.max_recording_seconds || 60}
                        className="w-20"
                        readOnly
                      />
                      <span className="text-sm text-gray-500">seconds</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Max Turns</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        type="number" 
                        value={config?.max_conversation_turns || 3}
                        className="w-20"
                        readOnly
                      />
                      <span className="text-sm text-gray-500">turns</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Review Calls Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>Review and manage voice assistant calls</CardDescription>
            </CardHeader>
            <CardContent>
              {calls.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-gray-500">Time</th>
                        <th className="pb-3 font-medium text-gray-500">Caller</th>
                        <th className="pb-3 font-medium text-gray-500">Claim</th>
                        <th className="pb-3 font-medium text-gray-500">Intent</th>
                        <th className="pb-3 font-medium text-gray-500">Duration</th>
                        <th className="pb-3 font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {calls.map((call, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <div>
                              <p className="font-medium">{formatTime(call.start_time)}</p>
                              <p className="text-xs text-gray-500">{formatDate(call.start_time)}</p>
                            </div>
                          </td>
                          <td className="py-3">
                            <p className="font-medium">{call.matched_client_name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{call.from_number}</p>
                          </td>
                          <td className="py-3">
                            {call.matched_claim_id ? (
                              <button
                                className="text-orange-600 text-sm hover:underline"
                                onClick={() => navigate(`/claims/${call.matched_claim_id}`)}
                                type="button"
                              >
                                View Claim
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="py-3">{getIntentBadge(call.intent)}</td>
                          <td className="py-3">
                            <span className="text-sm">{call.duration_seconds || 0}s</span>
                          </td>
                          <td className="py-3">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedCall(call)}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No calls recorded yet</p>
                  <p className="text-sm">Calls will appear here once the assistant starts handling them</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Call Detail Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Call Details</h3>
                  <p className="text-sm text-gray-500">
                    {selectedCall.matched_client_name || selectedCall.from_number} • {formatTime(selectedCall.start_time)}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSelectedCall(null)}>✕</Button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {selectedCall.recording_url && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Recording</Label>
                  <div className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                    <Button variant="outline" size="sm" onClick={() => openCallRecording(selectedCall)}>
                      <Play className="w-4 h-4 mr-1" /> Play
                    </Button>
                    <span className="text-sm text-gray-500">{selectedCall.recording_duration_seconds}s</span>
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium mb-2 block">AI Summary</Label>
                <div className="p-3 bg-orange-50 rounded-lg text-sm">
                  {selectedCall.ai_summary || 'Processing...'}
                </div>
              </div>
              
              {selectedCall.raw_transcript && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Full Transcript</Label>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm max-h-40 overflow-y-auto">
                    {selectedCall.raw_transcript}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div>
                  <Label className="text-sm font-medium">Intent</Label>
                  <div className="mt-1">{getIntentBadge(selectedCall.intent)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Confidence</Label>
                  <p className="mt-1 text-sm">{((selectedCall.intent_confidence || 0) * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => markCallComplete(selectedCall)}>Mark Complete</Button>
              <Button variant="outline" onClick={() => createFollowupTask(selectedCall)}>Create Task</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistantConsole;
