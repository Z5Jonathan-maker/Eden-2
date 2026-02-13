/**
 * PublicCard.jsx - Public Business Card View
 * Premium Tactical Military-Style Digital Business Card for sharing
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
  User, Mail, Phone, Share2, Star, Briefcase, Copy, 
  ExternalLink, MessageCircle, Loader2, Globe, CheckCircle,
  Target, Medal, QrCode, Shield
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { APP_LOGO } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const IMAGE_BASE = process.env.REACT_APP_IMAGE_BASE_URL || '/images';

// Premium Card Template Backgrounds
const CARD_TEMPLATES = {
  tactical_commander: {
    name: 'Tactical Commander',
    headerBg: `${IMAGE_BASE}/d2858ae2d2fbf2b68d5c5cf5f26b40de4cb624246a86642400e6d77e482c5146.png`,
    accentColor: '#f97316',
  },
  field_ops: {
    name: 'Field Operations',
    headerBg: `${IMAGE_BASE}/7949ddf4863d8f9a141681c863116fad065c1f26f1aa10ca2cfcdc047d74e8f6.png`,
    accentColor: '#22c55e',
  },
  elite_agent: {
    name: 'Elite Agent',
    headerBg: `${IMAGE_BASE}/f523f74e097cdb5307708aafec7decef0e3912d46ad87f888848bd60ce74540b.png`,
    accentColor: '#eab308',
  },
  tactical: {
    name: 'Tactical',
    headerBg: `${IMAGE_BASE}/d2858ae2d2fbf2b68d5c5cf5f26b40de4cb624246a86642400e6d77e482c5146.png`,
    accentColor: '#f97316',
  }
};

// Tactical Avatar Placeholder
const TACTICAL_AVATAR = `${IMAGE_BASE}/dbd66e96fb293c0a8b6c39d64f43cd97a71c8a56aa9f59527390c2ab5461412d.png`;

const PublicCard = () => {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewer_name: '',
    rating: 5,
    comment: ''
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mycard/public/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data.card);
        setQrCode(data.qr_code);
        setReviews(data.reviews || []);
        setAvgRating(data.average_rating || 0);
      } else {
        toast.error('Business card not found');
      }
    } catch (err) {
      console.error('Failed to fetch card:', err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const trackClick = async (type) => {
    try {
      await fetch(`${API_URL}/api/mycard/track-click/${slug}?click_type=${type}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to track click:', err);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied!');
    trackClick('link_copy');
  };

  const shareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.full_name}'s Business Card`,
          text: card.tagline || `Connect with ${card.full_name}`,
          url: window.location.href
        });
        fetch(`${API_URL}/api/mycard/track-share/${slug}`, { method: 'POST' });
      } catch (err) {
        if (err.name !== 'AbortError') copyShareLink();
      }
    } else {
      copyShareLink();
    }
  };

  const submitReview = async () => {
    if (!reviewForm.reviewer_name || !reviewForm.comment) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmittingReview(true);
    try {
      const params = new URLSearchParams({
        reviewer_name: reviewForm.reviewer_name,
        rating: reviewForm.rating.toString(),
        comment: reviewForm.comment
      });
      
      const res = await fetch(`${API_URL}/api/mycard/reviews/${slug}?${params}`, {
        method: 'POST'
      });
      
      if (res.ok) {
        toast.success('Review submitted!');
        setShowReviewForm(false);
        setReviewForm({ reviewer_name: '', rating: 5, comment: '' });
        fetchCard();
      } else {
        toast.error('Failed to submit review');
      }
    } catch (err) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm font-mono uppercase tracking-wider">Loading Card...</p>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
        <div className="text-center">
          <User className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <h2 className="text-xl text-white font-bold mb-2">Card Not Found</h2>
          <p className="text-zinc-500">This business card doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const template = CARD_TEMPLATES[card.card_style] || CARD_TEMPLATES.tactical_commander;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Card Container */}
        <div className="rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl" style={{
          boxShadow: `0 0 60px ${template.accentColor}15`
        }}>
          {/* Premium Header with AI Background */}
          <div className="h-40 relative overflow-hidden">
            <img 
              src={template.headerBg} 
              alt="Card Header" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
            
            {/* Logo */}
            <div className="absolute top-4 right-4">
              <img src={APP_LOGO} alt="Logo" className="w-10 h-10 opacity-70" />
            </div>

            {/* Template Badge */}
            <div className="absolute top-4 left-4">
              <Badge className="bg-zinc-900/80 text-zinc-300 border border-zinc-700/50 text-[10px] font-mono uppercase backdrop-blur-sm">
                <Target className="w-3 h-3 mr-1" style={{ color: template.accentColor }} />
                {template.name}
              </Badge>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-6 pb-6 -mt-16 relative z-10 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950">
            {/* Avatar */}
            <div className="flex items-end gap-4 mb-4">
              <div className="w-32 h-32 rounded-2xl border-4 border-zinc-900 overflow-hidden shadow-2xl" style={{
                boxShadow: `0 0 40px ${template.accentColor}30`
              }}>
                {card.profile_photo_url ? (
                  <img 
                    src={card.profile_photo_url} 
                    alt={card.full_name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src={TACTICAL_AVATAR} 
                    alt="Operator" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 pb-2">
                <h1 className="text-2xl font-bold text-white leading-tight tracking-wide" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  {card.full_name}
                </h1>
                <p className="font-medium" style={{ color: template.accentColor }}>
                  {card.title}
                </p>
              </div>
            </div>

            {/* Company & Rating */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <Briefcase className="w-4 h-4" />
                <span className="text-sm font-mono">{card.company}</span>
              </div>
              {avgRating > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-white font-bold">{avgRating}</span>
                  <span className="text-zinc-500 text-xs">({reviews.length})</span>
                </div>
              )}
            </div>

            {/* Tagline */}
            {card.tagline && (
              <div className="mb-4 p-3 bg-zinc-800/30 rounded-lg border-l-2" style={{ borderColor: template.accentColor }}>
                <p className="text-zinc-300 text-sm italic">"{card.tagline}"</p>
              </div>
            )}

            {/* Contact Buttons - Premium Style */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { icon: <Phone className="w-6 h-6" />, label: 'Call', href: `tel:${card.phone}`, onClick: () => trackClick('phone'), color: template.accentColor },
                { icon: <Mail className="w-6 h-6" />, label: 'Email', href: `mailto:${card.email}`, onClick: () => trackClick('email'), color: '#3b82f6' },
                { icon: <Share2 className="w-6 h-6" />, label: 'Share', href: '#', onClick: (e) => { e.preventDefault(); shareCard(); }, color: '#22c55e' },
              ].map((action, i) => (
                <a
                  key={i}
                  href={action.href}
                  onClick={action.onClick}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/30 hover:bg-zinc-700/40 transition-all group"
                >
                  <div className="p-2 rounded-lg transition-transform group-hover:scale-110" style={{ 
                    backgroundColor: `${action.color}15`,
                    color: action.color 
                  }}>
                    {action.icon}
                  </div>
                  <span className="text-xs text-zinc-400 font-mono uppercase">{action.label}</span>
                </a>
              ))}
            </div>

            {/* Bio */}
            {card.bio && (
              <div className="mb-5 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                <h3 className="text-xs uppercase tracking-wider mb-2 font-mono flex items-center gap-2" style={{ color: template.accentColor }}>
                  <Medal className="w-3 h-3" />
                  Operator Intel
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">{card.bio}</p>
              </div>
            )}

            {/* QR Code */}
            {qrCode && (
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/30 flex items-center gap-4 mb-5">
                <div className="bg-white p-2 rounded-xl shadow-lg">
                  <img src={`data:image/png;base64,${qrCode}`} alt="QR" className="w-24 h-24" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium mb-1 flex items-center gap-2">
                    <QrCode className="w-4 h-4" style={{ color: template.accentColor }} />
                    Scan to Save
                  </p>
                  <p className="text-zinc-500 text-xs mb-3 font-mono">Save contact or share this card</p>
                  <button
                    onClick={copyShareLink}
                    className="flex items-center gap-2 text-sm font-mono hover:opacity-80 transition-opacity"
                    style={{ color: template.accentColor }}
                  >
                    <Copy className="w-4 h-4" />
                    COPY LINK
                  </button>
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm text-white font-semibold flex items-center gap-2 font-mono uppercase">
                  <MessageCircle className="w-4 h-4" style={{ color: template.accentColor }} />
                  Reviews
                </h3>
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="text-xs hover:opacity-80 font-mono"
                  style={{ color: template.accentColor }}
                >
                  Leave a Review
                </button>
              </div>

              {/* Review Form */}
              {showReviewForm && (
                <div className="p-4 bg-zinc-800/40 rounded-xl mb-3 animate-fade-in" style={{ borderColor: `${template.accentColor}50`, borderWidth: 1 }}>
                  <Input
                    placeholder="Your name"
                    value={reviewForm.reviewer_name}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })}
                    className="bg-zinc-900/50 border-zinc-700/30 text-white placeholder:text-zinc-600 mb-3"
                  />
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-zinc-400 text-sm font-mono">Rating:</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button 
                        key={n} 
                        onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                      >
                        <Star 
                          className={`w-6 h-6 transition-transform hover:scale-110 ${n <= reviewForm.rating ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} 
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Your review..."
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    rows={3}
                    className="bg-zinc-900/50 border-zinc-700/30 text-white placeholder:text-zinc-600 mb-3 resize-none"
                  />
                  <Button 
                    onClick={submitReview} 
                    disabled={submittingReview}
                    className="w-full"
                    style={{ backgroundColor: template.accentColor }}
                  >
                    {submittingReview ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Submit Review
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Review List */}
              {reviews.length > 0 ? (
                <div className="space-y-2">
                  {reviews.slice(0, 3).map((review, i) => (
                    <div key={i} className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium">{review.reviewer_name}</span>
                        <div className="flex">
                          {[...Array(5)].map((_, j) => (
                            <Star 
                              key={j} 
                              className={`w-3 h-3 ${j < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-700'}`} 
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-zinc-400 text-xs">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-600 text-xs text-center py-4 font-mono">No reviews yet</p>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-zinc-800">
              <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
                Powered by Operation Eden // Secure Card v2.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicCard;
