/**
 * MyCard.jsx - Digital Business Card
 * Enzy-Style Digital Business Card with Premium Tactical Military Graphics
 * Features: Profile, QR Code, Contact Actions, Gallery, Reviews, Analytics
 * Template Presets: Tactical Commander, Field Ops, Elite Agent
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Mail, Phone, MapPin, Share2, Eye, Copy, Edit2, Save, X,
  QrCode, Star, Camera, Briefcase, Globe, Linkedin, Twitter, Instagram,
  ExternalLink, Download, ChevronRight, MessageCircle, Award, TrendingUp,
  Check, Loader2, Sparkles, Shield, Zap, BarChart3, Users, Palette,
  Target, Crosshair, Medal
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { APP_LOGO, TIER_BADGES, PAGE_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const IMAGE_BASE = process.env.REACT_APP_IMAGE_BASE_URL || '/images';

// Premium Card Template Backgrounds
const CARD_TEMPLATES = {
  tactical_commander: {
    name: 'Tactical Commander',
    description: 'Premium gunmetal with HUD elements',
    headerBg: `${IMAGE_BASE}/d2858ae2d2fbf2b68d5c5cf5f26b40de4cb624246a86642400e6d77e482c5146.png`,
    accentColor: '#f97316',
    gradientFrom: 'from-zinc-800',
    gradientVia: 'via-zinc-900',
    gradientTo: 'to-black',
  },
  field_ops: {
    name: 'Field Operations',
    description: 'Tactical camo with radar display',
    headerBg: `${IMAGE_BASE}/7949ddf4863d8f9a141681c863116fad065c1f26f1aa10ca2cfcdc047d74e8f6.png`,
    accentColor: '#22c55e',
    gradientFrom: 'from-green-900/20',
    gradientVia: 'via-zinc-900',
    gradientTo: 'to-black',
  },
  elite_agent: {
    name: 'Elite Agent',
    description: 'Carbon fiber with gold accents',
    headerBg: `${IMAGE_BASE}/f523f74e097cdb5307708aafec7decef0e3912d46ad87f888848bd60ce74540b.png`,
    accentColor: '#eab308',
    gradientFrom: 'from-yellow-900/10',
    gradientVia: 'via-zinc-900',
    gradientTo: 'to-black',
  }
};

// Tactical Avatar Placeholder
const TACTICAL_AVATAR = 'https://static.prod-images.emergentagent.com/jobs/b5a496fc-53ea-4e10-8dbc-fada22814f3b/images/dbd66e96fb293c0a8b6c39d64f43cd97a71c8a56aa9f59527390c2ab5461412d.png';

const MyCard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState(null);
  const [hasCard, setHasCard] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [cardUrl, setCardUrl] = useState('');
  const [analytics, setAnalytics] = useState({ total_views: 0, shares: 0 });
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [selectedTemplate, setSelectedTemplate] = useState('tactical_commander');
  const [teamCards, setTeamCards] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    title: '',
    company: '',
    phone: '',
    email: '',
    bio: '',
    tagline: '',
    card_style: 'tactical_commander',
    accent_color: '#f97316'
  });

  const fetchCard = useCallback(async () => {
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/mycard/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCard(data.card);
        setHasCard(data.has_card);
        setQrCode(data.qr_code);
        setCardUrl(data.card_url || '');
        setAnalytics(data.analytics || { total_views: 0, shares: 0 });
        setReviews(data.reviews || []);
        setAvgRating(data.average_rating || 0);
        
        if (data.card) {
          setFormData({
            full_name: data.card.full_name || '',
            title: data.card.title || '',
            company: data.card.company || '',
            phone: data.card.phone || '',
            email: data.card.email || '',
            bio: data.card.bio || '',
            tagline: data.card.tagline || '',
            card_style: data.card.card_style || 'tactical_commander',
            accent_color: data.card.accent_color || '#f97316'
          });
          setSelectedTemplate(data.card.card_style || 'tactical_commander');
        }
      }
    } catch (err) {
      console.error('Failed to fetch card:', err);
      toast.error('Failed to load business card');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const createCard = async () => {
    if (!formData.full_name) {
      toast.error('Please enter your name');
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('eden_token');
      const cardData = {
        ...formData,
        card_style: selectedTemplate,
        accent_color: CARD_TEMPLATES[selectedTemplate]?.accentColor || '#f97316'
      };
      
      const res = await fetch(`${API_URL}/api/mycard/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cardData)
      });
      
      if (res.ok) {
        toast.success('Business card created!');
        fetchCard();
        setIsEditing(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create card');
      }
    } catch (err) {
      toast.error('Failed to create business card');
    } finally {
      setSaving(false);
    }
  };

  const updateCard = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('eden_token');
      const cardData = {
        ...formData,
        card_style: selectedTemplate,
        accent_color: CARD_TEMPLATES[selectedTemplate]?.accentColor || '#f97316'
      };
      
      const res = await fetch(`${API_URL}/api/mycard/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cardData)
      });
      
      if (res.ok) {
        toast.success('Business card updated!');
        fetchCard();
        setIsEditing(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update card');
      }
    } catch (err) {
      toast.error('Failed to update business card');
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = () => {
    const fullUrl = `${window.location.origin}${cardUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copied to clipboard!');
  };

  const shareCard = async () => {
    const fullUrl = `${window.location.origin}${cardUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.full_name}'s Business Card`,
          text: card.tagline || `Connect with ${card.full_name}`,
          url: fullUrl
        });
        fetch(`${API_URL}/api/mycard/track-share/${card.slug}`, { method: 'POST' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyShareLink();
        }
      }
    } else {
      copyShareLink();
    }
  };

  const fetchTeamCards = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mycard/team`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamCards(data.team_cards || []);
      }
    } catch (err) {
      console.error('Failed to fetch team cards:', err);
    }
  }, []);

  const currentTemplate = CARD_TEMPLATES[selectedTemplate] || CARD_TEMPLATES.tactical_commander;

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-tactical-animated">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading MyCard...</p>
        </div>
      </div>
    );
  }

  // Template Selector Component
  const TemplateSelector = () => (
    <div className="mb-6">
      <Label className="text-zinc-300 font-mono text-sm mb-3 block">SELECT CARD TEMPLATE</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(CARD_TEMPLATES).map(([key, template]) => (
          <button
            key={key}
            onClick={() => setSelectedTemplate(key)}
            className={`relative overflow-hidden rounded-xl border-2 transition-all ${
              selectedTemplate === key 
                ? 'border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]' 
                : 'border-zinc-700/30 hover:border-zinc-600'
            }`}
          >
            <div className="h-24 relative">
              <img 
                src={template.headerBg} 
                alt={template.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              {selectedTemplate === key && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <div className="p-3 bg-zinc-900">
              <p className="font-tactical font-bold text-white text-sm">{template.name}</p>
              <p className="text-zinc-500 text-xs">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Card Creation/Edit Form
  const renderEditForm = () => (
    <div className="card-tactical p-6 max-w-2xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
            <User className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-tactical font-bold text-white text-xl uppercase">
            {hasCard ? 'Edit Your Card' : 'Create Your Card'}
          </h2>
        </div>
        {hasCard && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      {/* Template Selector */}
      <TemplateSelector />

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-300 font-mono text-sm">OPERATOR NAME *</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Smith"
              className="input-tactical"
            />
          </div>
          <div>
            <Label className="text-zinc-300 font-mono text-sm">RANK / TITLE</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Field Commander"
              className="input-tactical"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-300 font-mono text-sm">ORGANIZATION</Label>
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Care Claims"
              className="input-tactical"
            />
          </div>
          <div>
            <Label className="text-zinc-300 font-mono text-sm">CALLSIGN / TAGLINE</Label>
            <Input
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              placeholder="Your trusted claims advocate"
              className="input-tactical"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-zinc-300 font-mono text-sm">COMMS (PHONE)</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="input-tactical"
            />
          </div>
          <div>
            <Label className="text-zinc-300 font-mono text-sm">SECURE EMAIL</Label>
            <Input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="operator@careclaims.com"
              className="input-tactical"
            />
          </div>
        </div>

        <div>
          <Label className="text-zinc-300 font-mono text-sm">OPERATOR BIO</Label>
          <Textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Your mission experience and expertise..."
            rows={4}
            className="input-tactical resize-none"
          />
        </div>

        <Button 
          onClick={hasCard ? updateCard : createCard}
          disabled={saving}
          className="btn-tactical w-full"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              {hasCard ? 'Update Card' : 'Deploy Business Card'}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Premium Card Preview Component
  const renderCardPreview = () => {
    const template = CARD_TEMPLATES[card?.card_style] || CARD_TEMPLATES.tactical_commander;
    
    return (
      <div className="max-w-md mx-auto">
        {/* Card Container */}
        <div className="rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl animate-fade-in-up relative" style={{
          boxShadow: `0 0 40px ${template.accentColor}20`
        }}>
          {/* Premium Header with AI Background */}
          <div className="h-36 relative overflow-hidden">
            <img 
              src={template.headerBg} 
              alt="Card Header" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
            
            {/* Company Logo */}
            <div className="absolute top-3 right-3">
              <img src={APP_LOGO} alt="Logo" className="w-10 h-10 object-contain opacity-80" />
            </div>

            {/* Template Badge */}
            <div className="absolute top-3 left-3">
              <Badge className="bg-zinc-900/80 text-zinc-300 border border-zinc-700/50 text-[10px] font-mono uppercase">
                <Target className="w-3 h-3 mr-1" style={{ color: template.accentColor }} />
                {template.name}
              </Badge>
            </div>
          </div>

          {/* Profile Section */}
          <div className={`px-5 pb-5 -mt-14 relative z-10 bg-gradient-to-b ${template.gradientFrom} ${template.gradientVia} ${template.gradientTo}`}>
            {/* Avatar */}
            <div className="flex items-end gap-4 mb-4">
              <div className="w-28 h-28 rounded-2xl border-4 border-zinc-900 overflow-hidden shadow-2xl relative" style={{
                boxShadow: `0 0 30px ${template.accentColor}40`
              }}>
                {card?.profile_photo_url ? (
                  <img 
                    src={card.profile_photo_url} 
                    alt={card.full_name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src={TACTICAL_AVATAR} 
                    alt="Operator Avatar" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 pb-2">
                <h2 className="font-tactical font-bold text-white text-xl leading-tight tracking-wide">
                  {card?.full_name || 'OPERATOR NAME'}
                </h2>
                <p className="text-sm font-medium" style={{ color: template.accentColor }}>
                  {card?.title || 'Field Commander'}
                </p>
              </div>
            </div>

            {/* Company & Rating */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <Briefcase className="w-4 h-4" />
                <span className="text-sm font-mono">{card?.company || 'Care Claims'}</span>
              </div>
              {avgRating > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-white font-bold text-sm">{avgRating}</span>
                  <span className="text-zinc-500 text-xs">({reviews.length})</span>
                </div>
              )}
            </div>

            {/* Tagline */}
            {card?.tagline && (
              <div className="mb-4 p-3 bg-zinc-800/30 rounded-lg border-l-2" style={{ borderColor: template.accentColor }}>
                <p className="text-zinc-300 text-sm italic">"{card.tagline}"</p>
              </div>
            )}

            {/* Contact Buttons - Premium Style */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { icon: <Phone className="w-5 h-5" />, label: 'Call', href: `tel:${card?.phone}`, color: template.accentColor },
                { icon: <Mail className="w-5 h-5" />, label: 'Email', href: `mailto:${card?.email}`, color: '#3b82f6' },
                { icon: <Share2 className="w-5 h-5" />, label: 'Share', onClick: shareCard, color: '#22c55e' },
              ].map((action, i) => (
                <a
                  key={i}
                  href={action.href}
                  onClick={action.onClick ? (e) => { e.preventDefault(); action.onClick(); } : undefined}
                  className="flex flex-col items-center gap-2 p-3 bg-zinc-800/40 rounded-xl border border-zinc-700/30 hover:bg-zinc-700/40 transition-all group cursor-pointer"
                >
                  <div className="p-2 rounded-lg transition-transform group-hover:scale-110" style={{ 
                    backgroundColor: `${action.color}20`,
                    color: action.color 
                  }}>
                    {action.icon}
                  </div>
                  <span className="text-xs text-zinc-400 font-mono uppercase">{action.label}</span>
                </a>
              ))}
            </div>

            {/* Bio */}
            {card?.bio && (
              <div className="mb-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                <h4 className="text-xs uppercase tracking-wider mb-2 font-mono flex items-center gap-2" style={{ color: template.accentColor }}>
                  <Medal className="w-3 h-3" />
                  Operator Intel
                </h4>
                <p className="text-zinc-300 text-sm leading-relaxed">{card.bio}</p>
              </div>
            )}

            {/* QR Code Section - Premium Style */}
            {qrCode && (
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30 flex items-center gap-4">
                <div className="bg-white p-2 rounded-xl shadow-lg">
                  <img 
                    src={`data:image/png;base64,${qrCode}`} 
                    alt="QR Code" 
                    className="w-24 h-24"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-zinc-200 text-sm font-medium mb-1 flex items-center gap-2">
                    <QrCode className="w-4 h-4" style={{ color: template.accentColor }} />
                    Scan to Connect
                  </p>
                  <p className="text-zinc-500 text-xs mb-3 font-mono">Secure link • Track opens</p>
                  <button
                    onClick={copyShareLink}
                    className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity font-mono"
                    style={{ color: template.accentColor }}
                  >
                    <Copy className="w-3 h-3" />
                    COPY LINK
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
              <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
                Powered by Operation Eden // Secure Card v2.0
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <Button 
            onClick={() => setIsEditing(true)}
            variant="outline"
            className="flex-1 border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Card
          </Button>
          <Button 
            onClick={shareCard}
            className="flex-1 btn-tactical"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>
    );
  };

  // Analytics Tab
  const renderAnalytics = () => (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in-up">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Eye className="w-5 h-5" />, label: 'Total Views', value: analytics.total_views || 0, color: 'text-blue-500' },
          { icon: <Share2 className="w-5 h-5" />, label: 'Shares', value: analytics.shares || 0, color: 'text-green-500' },
          { icon: <QrCode className="w-5 h-5" />, label: 'QR Scans', value: analytics.qr_scans || 0, color: 'text-purple-500' },
          { icon: <Star className="w-5 h-5" />, label: 'Avg Rating', value: avgRating || '-', color: 'text-yellow-500' },
        ].map((stat, i) => (
          <div key={i} className="card-tactical p-4 text-center">
            <div className={`${stat.color} mb-2 flex justify-center`}>{stat.icon}</div>
            <p className="text-2xl font-tactical font-bold text-white">{stat.value}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Reviews Section */}
      <div className="card-tactical p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-5 h-5 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase">Recent Reviews</h3>
        </div>
        
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review, i) => (
              <div key={i} className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium text-sm">{review.reviewer_name}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star 
                        key={j} 
                        className={`w-3 h-3 ${j < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-zinc-400 text-sm">{review.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-mono">No reviews yet</p>
            <p className="text-xs">Share your card to collect reviews!</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-tactical-animated page-enter" data-testid="mycard-page">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <img 
            src={PAGE_ICONS.my_card} 
            alt="My Card" 
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              MY CARD
            </h1>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
              Digital Business Card // Share & Track // Premium Templates
            </p>
          </div>
        </div>
      </div>

      {/* Show edit form if no card or in editing mode */}
      {(!hasCard || isEditing) ? (
        renderEditForm()
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
            {[
              { id: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
              { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'team') fetchTeamCards();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm uppercase transition-all ${
                  activeTab === tab.id 
                    ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'preview' && renderCardPreview()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'team' && (
            <div className="space-y-4 animate-fade-in-up" data-testid="team-cards-tab">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-tactical font-bold text-white uppercase text-lg tracking-wide">Squad Cards</h2>
                <span className="text-zinc-500 font-mono text-sm">{teamCards.length} members</span>
              </div>
              {teamCards.length === 0 ? (
                <div className="card-tactical p-8 text-center">
                  <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 font-tactical">No team cards yet</p>
                  <p className="text-zinc-600 font-mono text-xs mt-1">Team members need to create their cards</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                  {teamCards.map(({ card: tc, analytics: ta }) => (
                    <div
                      key={tc.user_id}
                      className="card-tactical p-4 shadow-tactical hover-lift-sm cursor-pointer"
                      onClick={() => tc.slug && window.open(`/card/${tc.slug}`, '_blank')}
                      data-testid={`team-card-${tc.user_id}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-tactical font-bold text-lg">
                          {(tc.full_name || '?').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-tactical font-bold text-white truncate">{tc.full_name}</p>
                          <p className="text-zinc-500 font-mono text-xs truncate">{tc.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-500">{tc.company}</span>
                        <div className="flex gap-3">
                          <span className="text-blue-400">{ta?.total_views || 0} views</span>
                          <span className="text-green-400">{ta?.shares || 0} shares</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyCard;
