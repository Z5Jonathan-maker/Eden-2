/**
 * ClaimCommsPanel - SMS Communication Panel for Claims
 * 
 * A chat-style interface for viewing and sending SMS messages for a claim.
 * Features:
 * - Chronological message display (chat-style)
 * - Outbound message aligned right (Eden → Client)
 * - Inbound message aligned left (Client → Eden)
 * - Status indicators (sent, delivered, failed, received)
 * - Template selector for common messages
 * - Auto-scroll to latest message
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { 
  Send, 
  MessageSquare, 
  Loader2, 
  ChevronDown,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Status badge colors
const STATUS_COLORS = {
  queued: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  received: 'bg-purple-100 text-purple-700'
};

// Status icons
const STATUS_ICONS = {
  queued: Clock,
  sent: CheckCircle2,
  delivered: CheckCircle2,
  failed: XCircle,
  received: MessageSquare
};

const ClaimCommsPanel = ({ claimId, clientPhone, clientName }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [smsBody, setSmsBody] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(clientPhone || '');
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // Fetch messages on mount and periodically
  useEffect(() => {
    fetchMessages();
    fetchTemplates();
    fetchSmsStatus();
    
    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [claimId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('eden_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/claims/${claimId}/messages`,
        { headers: getAuthHeaders() }
      );
      
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/sms/templates`,
        { headers: getAuthHeaders() }
      );
      
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const fetchSmsStatus = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/sms/status`,
        { headers: getAuthHeaders() }
      );
      
      if (res.ok) {
        const data = await res.json();
        setSmsStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch SMS status:', err);
    }
  };

  const handleSendSMS = async () => {
    if (!smsBody.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(
        `${API_URL}/api/claims/${claimId}/messages/sms/send`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            to: phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber.replace(/\D/g, '')}`,
            body: smsBody
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        // Add to messages list immediately
        setMessages(prev => [...prev, {
          ...data,
          direction: 'outbound',
          channel: 'sms',
          created_by_name: 'You'
        }]);
        setSmsBody('');
        toast.success('SMS sent successfully');
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to send SMS');
      }
    } catch (err) {
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (template) => {
    setSmsBody(template.template);
    setShowTemplates(false);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {});

  const StatusIcon = ({ status }) => {
    const Icon = STATUS_ICONS[status] || Clock;
    return <Icon className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* SMS Status Banner */}
      {smsStatus && !smsStatus.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Twilio Not Configured</p>
            <p className="text-amber-700">
              {smsStatus.dry_run_mode 
                ? 'Running in dry-run mode. Messages will be logged but not sent.'
                : 'Add Twilio credentials to send real SMS messages.'}
            </p>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-4 space-y-4" data-testid="messages-container">
        {Object.keys(groupedMessages).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation by sending an SMS below</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {formatDate(msgs[0].created_at)}
                </div>
              </div>
              
              {/* Messages for this date */}
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-3`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.direction === 'outbound'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    {/* Sender info for inbound */}
                    {msg.direction === 'inbound' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{msg.from || 'Client'}</span>
                      </div>
                    )}
                    
                    {/* Message body */}
                    <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                    
                    {/* Footer: time + status */}
                    <div className={`flex items-center justify-end gap-2 mt-2 text-xs ${
                      msg.direction === 'outbound' ? 'text-orange-100' : 'text-gray-400'
                    }`}>
                      <span>{formatTime(msg.created_at)}</span>
                      {msg.direction === 'outbound' && (
                        <div className="flex items-center gap-1">
                          <StatusIcon status={msg.status} />
                          <span className="capitalize">{msg.status}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Sender name for outbound */}
                    {msg.direction === 'outbound' && msg.created_by_name && (
                      <div className="text-xs text-orange-100 mt-1">
                        Sent by {msg.created_by_name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose Area */}
      <div className="mt-4 space-y-3">
        {/* Phone Number Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="tel"
              placeholder="Client phone number (+1...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="sms-phone-input"
            />
          </div>
          
          {/* Template Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              data-testid="template-selector-btn"
            >
              Templates
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
            
            {showTemplates && (
              <div className="absolute right-0 bottom-full mb-2 w-72 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                    onClick={() => handleTemplateSelect(template)}
                    data-testid={`template-${template.key}`}
                  >
                    <p className="font-medium text-sm text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500 truncate">{template.template}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Message Input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            className="flex-1 min-h-[80px] max-h-[120px]"
            data-testid="sms-body-input"
          />
          <Button
            onClick={handleSendSMS}
            disabled={sending || !smsBody.trim()}
            className="bg-orange-600 hover:bg-orange-700 h-auto"
            data-testid="send-sms-btn"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {/* Character count */}
        <div className="text-xs text-gray-500 text-right">
          {smsBody.length} / 1600 characters
          {smsBody.length > 160 && (
            <span className="ml-2">
              ({Math.ceil(smsBody.length / 160)} SMS segments)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimCommsPanel;
