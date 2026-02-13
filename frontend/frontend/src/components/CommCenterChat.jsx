import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '../lib/api';
import twilioChatService from '../services/TwilioChatService';
import { useNavigate } from 'react-router-dom';

const CommCenterChat = () => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState('');
  const endRef = useRef(null);
  const navigate = useNavigate();

  const initChat = async () => {
    const initRes = await apiPost('/api/comm/conversations/init', {
      unique_name: 'eden-internal-chat',
      friendly_name: 'Eden Internal Chat',
      initial_message: 'Internal chat ready for ops updates.'
    });

    if (!initRes.ok) {
      toast.error(initRes.error || 'Failed to initialize chat');
      setLoading(false);
      return;
    }

    const { token, conversation_sid } = initRes.data;
    const client = await twilioChatService.initClient(token, refreshToken);
    const conv = await client.getConversationBySid(conversation_sid);

    const paginator = await conv.getMessages(50);
    setMessages(paginator.items || []);
    setConversation(conv);
    setLoading(false);

    conv.on('messageAdded', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    conv.on('typingStarted', (participant) => {
      setTyping((prev) => (prev.includes(participant.identity) ? prev : [...prev, participant.identity]));
    });
    conv.on('typingEnded', (participant) => {
      setTyping((prev) => prev.filter((p) => p !== participant.identity));
    });
  };

  const refreshToken = async () => {
    const res = await apiGet('/api/comm/conversations/token');
    if (res.ok) {
      await twilioChatService.initClient(res.data.token, refreshToken);
    }
  };

  useEffect(() => {
    initChat();
    return () => {
      twilioChatService.shutdown();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const loadClaims = async () => {
      const res = await apiGet('/api/claims/');
      if (res.ok) {
        setClaims(res.data || []);
      }
    };
    loadClaims();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !conversation) return;
    await conversation.sendMessage(input.trim());
    setInput('');
  };

  const filteredClaims = claims.filter((claim) => {
    const query = search.toLowerCase();
    return (
      (claim.claim_number || '').toLowerCase().includes(query) ||
      (claim.client_name || claim.insured_name || '').toLowerCase().includes(query) ||
      (claim.property_address || claim.loss_location || '').toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="spinner-tactical w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 page-enter">
      <div className="lg:col-span-2 card-tactical p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-orange-400" />
          <h1 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">Internal Chat</h1>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-900/40 border border-zinc-700/40 rounded-lg p-3 space-y-3">
          {messages.map((msg) => (
            <div key={msg.sid} className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-mono">{msg.author}</span>
              <div className="bg-zinc-800/70 border border-zinc-700/40 rounded-lg p-2 text-sm text-zinc-200">
                {msg.body}
              </div>
              <span className="text-[10px] text-zinc-600 font-mono">
                {msg.dateCreated ? new Date(msg.dateCreated).toLocaleTimeString() : ''}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {typing.length > 0 && (
          <div className="text-xs text-zinc-500 mt-2">
            {typing.join(', ')} typing...
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              conversation?.typing();
            }}
            className="input-tactical flex-1 px-3 py-2 text-sm"
            placeholder="Type an internal message..."
          />
          <button onClick={handleSend} className="btn-tactical px-4 py-2 text-sm">Send</button>
        </div>
      </div>

      <div className="card-tactical p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">Client Threads</h2>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-tactical w-full pl-9 pr-3 py-2 text-sm"
            placeholder="Search claims..."
          />
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {filteredClaims.slice(0, 20).map((claim) => (
            <button
              key={claim.id}
              onClick={() => navigate(`/comms/claim/${claim.id}`)}
              className="w-full text-left p-2 rounded-lg border border-zinc-700/40 bg-zinc-900/40 hover:border-orange-500/40 transition-all"
            >
              <div className="text-sm text-zinc-200 truncate">
                {claim.client_name || claim.insured_name || 'Unknown'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono truncate">
                {claim.claim_number ? `#${claim.claim_number}` : 'No claim #'} • {claim.property_address || claim.loss_location || 'No address'}
              </div>
            </button>
          ))}
          {filteredClaims.length === 0 && (
            <p className="text-xs text-zinc-500">No matching claims.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommCenterChat;
