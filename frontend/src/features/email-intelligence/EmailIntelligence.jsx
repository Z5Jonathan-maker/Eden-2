/**
 * Email Intelligence — Writing DNA Engine
 *
 * Scans Gmail sent folder, builds a writing DNA profile,
 * extracts reusable templates. DNA auto-injects into all AI responses.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { emailIntelligenceService } from '../../services/emailIntelligenceService';
import { toast } from 'sonner';
import {
  Brain,
  Mail,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  MessageSquare,
  PenTool,
  Gauge,
  ChevronDown,
  ChevronUp,
  Edit3,
  X,
  Save,
} from 'lucide-react';

const CATEGORY_LABELS = {
  follow_up: 'Follow Up',
  status_update: 'Status Update',
  introduction: 'Introduction',
  request: 'Request',
  thank_you: 'Thank You',
  scheduling: 'Scheduling',
  general: 'General',
};

const CATEGORY_COLORS = {
  follow_up: '#8B5CF6',
  status_update: '#3B82F6',
  introduction: '#10B981',
  request: '#F59E0B',
  thank_you: '#EC4899',
  scheduling: '#06B6D4',
  general: '#6B7280',
};

// Score bar component
const ScoreBar = ({ label, value, max = 10, color = '#F97316' }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-xs font-mono text-zinc-300 w-8 text-right">{value}/{max}</span>
  </div>
);

// DNA Profile Card
const DnaProfileCard = ({ profile }) => {
  const [expanded, setExpanded] = useState(true);

  if (!profile) return null;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-orange-400" />
          <h3 className="text-white font-bold text-sm">Your Writing DNA</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Summary */}
          {profile.summary && (
            <p className="text-zinc-300 text-sm leading-relaxed border-l-2 border-orange-500 pl-3">
              {profile.summary}
            </p>
          )}

          {/* Scores */}
          <div className="space-y-2">
            <ScoreBar label="Formality" value={profile.formality || 5} color="#3B82F6" />
            <ScoreBar label="Directness" value={profile.directness || 5} color="#F97316" />
            <ScoreBar label="Warmth" value={profile.warmth || 5} color="#EC4899" />
          </div>

          {/* Tone + Style */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Tone</span>
              </div>
              <span className="text-zinc-200 text-sm font-medium capitalize">
                {profile.tone || 'Mixed'}
              </span>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <PenTool className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Style</span>
              </div>
              <span className="text-zinc-200 text-sm font-medium capitalize">
                {profile.sentence_style || 'Mixed'}
              </span>
            </div>
          </div>

          {/* Greetings & Sign-offs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Greetings</span>
              <div className="flex flex-wrap gap-1">
                {(profile.greetings || []).slice(0, 4).map((g, i) => (
                  <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                    {g}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Sign-offs</span>
              <div className="flex flex-wrap gap-1">
                {(profile.sign_offs || []).slice(0, 4).map((s, i) => (
                  <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Signature Phrases */}
          {profile.phrases?.length > 0 && (
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">
                Signature Phrases
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.phrases.slice(0, 8).map((p, i) => (
                  <span
                    key={i}
                    className="text-xs bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-0.5 rounded-full"
                  >
                    "{p}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personality Traits */}
          {profile.personality_traits?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.personality_traits.slice(0, 5).map((t, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded-full capitalize"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
            <span>{profile.scanned_count || 0} emails analyzed</span>
            <span>
              Last scan: {profile.last_scanned
                ? new Date(profile.last_scanned).toLocaleDateString()
                : 'Never'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Template Card
const TemplateCard = ({ template, onDelete, onCopy, onEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: template.name,
    subject_template: template.subject_template,
    body_template: template.body_template,
  });

  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general;

  const handleSaveEdit = async () => {
    try {
      await onEdit(template.id, editData);
      setEditing(false);
      toast.success('Template updated');
    } catch {
      toast.error('Failed to update template');
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => !editing && setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="text-left">
            <span className="text-zinc-200 text-sm font-medium block">{template.name}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {CATEGORY_LABELS[template.category] || template.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(template); }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Copy template"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); setExpanded(true); }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Edit template"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
            className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"
            title="Delete template"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500/70" />
          </button>
          {!editing && (
            expanded
              ? <ChevronUp className="w-4 h-4 text-zinc-500" />
              : <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {editing ? (
            <>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full bg-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Subject</label>
                <input
                  value={editData.subject_template}
                  onChange={(e) => setEditData({ ...editData, subject_template: e.target.value })}
                  className="w-full bg-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Body</label>
                <textarea
                  value={editData.body_template}
                  onChange={(e) => setEditData({ ...editData, body_template: e.target.value })}
                  rows={5}
                  className="w-full bg-zinc-800 text-zinc-200 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => { setEditing(false); setEditData({ name: template.name, subject_template: template.subject_template, body_template: template.body_template }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {template.description && (
                <p className="text-zinc-400 text-xs">{template.description}</p>
              )}
              {template.subject_template && (
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Subject</span>
                  <div className="bg-zinc-800/50 rounded-lg px-3 py-2 text-zinc-300 text-sm font-mono">
                    {template.subject_template}
                  </div>
                </div>
              )}
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Body</span>
                <div className="bg-zinc-800/50 rounded-lg px-3 py-2 text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {template.body_template}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Main Page
const EmailIntelligence = () => {
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  // Load everything on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [statusData, profileData, templatesData] = await Promise.allSettled([
          emailIntelligenceService.getStatus(),
          emailIntelligenceService.getProfile(),
          emailIntelligenceService.getTemplates(),
        ]);

        if (statusData.status === 'fulfilled') setStatus(statusData.value);
        if (profileData.status === 'fulfilled') setProfile(profileData.value);
        if (templatesData.status === 'fulfilled') setTemplates(templatesData.value.templates || []);
      } catch (err) {
        console.warn('Failed to load email intelligence data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Start scan
  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const result = await emailIntelligenceService.scan();
      toast.success(result.message || 'Email scan complete!');

      // Reload data
      const [profileData, templatesData, statusData] = await Promise.allSettled([
        emailIntelligenceService.getProfile(),
        emailIntelligenceService.getTemplates(),
        emailIntelligenceService.getStatus(),
      ]);
      if (profileData.status === 'fulfilled') setProfile(profileData.value);
      if (templatesData.status === 'fulfilled') setTemplates(templatesData.value.templates || []);
      if (statusData.status === 'fulfilled') setStatus(statusData.value);
    } catch (err) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  // Delete template
  const handleDeleteTemplate = useCallback(async (templateId) => {
    try {
      await emailIntelligenceService.deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  }, []);

  // Copy template to clipboard
  const handleCopyTemplate = useCallback((template) => {
    const text = `Subject: ${template.subject_template}\n\n${template.body_template}`;
    navigator.clipboard.writeText(text);
    toast.success('Template copied to clipboard');
  }, []);

  // Edit template
  const handleEditTemplate = useCallback(async (templateId, data) => {
    await emailIntelligenceService.updateTemplate(templateId, data);
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, ...data, updated_at: new Date().toISOString() } : t))
    );
  }, []);

  // Filter templates
  const filteredTemplates = activeCategory
    ? templates.filter((t) => t.category === activeCategory)
    : templates;

  // Unique categories from templates
  const categories = [...new Set(templates.map((t) => t.category))];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Email DNA</h1>
              <p className="text-zinc-500 text-xs">
                Your writing style powers every AI response
              </p>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              scanning
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : profile
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : profile ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Rescan
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Scan My Emails
              </>
            )}
          </button>
        </div>

        {/* Status banner */}
        {!profile && !scanning && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-orange-300 text-sm font-bold mb-1">No Writing DNA Yet</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Click "Scan My Emails" to analyze your Gmail sent folder. Eden will learn your
                writing style and inject it into every AI response — Eve, SMS drafts, comms copilot,
                everything will sound like <span className="text-orange-300 font-medium">you</span>.
              </p>
            </div>
          </div>
        )}

        {/* Scanning progress */}
        {scanning && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
            <div>
              <h3 className="text-blue-300 text-sm font-bold">Analyzing Your Emails...</h3>
              <p className="text-zinc-400 text-xs">
                Reading sent emails, extracting patterns, building your DNA profile. This takes 30-60 seconds.
              </p>
            </div>
          </div>
        )}

        {/* DNA Profile */}
        <DnaProfileCard profile={profile} />

        {/* How it works */}
        {profile && (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-xs font-bold uppercase tracking-wider">DNA Active</span>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Your writing DNA is now injected into <span className="text-zinc-200 font-medium">every AI response</span> across Eden.
              Eve chat, SMS drafts, comms copilot, team messages — they all match your voice.
            </p>
          </div>
        )}

        {/* Templates Section */}
        {templates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-500" />
                <h2 className="text-zinc-300 text-sm font-bold">
                  Extracted Templates ({templates.length})
                </h2>
              </div>
            </div>

            {/* Category filter */}
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    !activeCategory
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      activeCategory === cat
                        ? 'text-white border'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300'
                    }`}
                    style={
                      activeCategory === cat
                        ? { backgroundColor: `${CATEGORY_COLORS[cat]}20`, borderColor: `${CATEGORY_COLORS[cat]}40`, color: CATEGORY_COLORS[cat] }
                        : {}
                    }
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </button>
                ))}
              </div>
            )}

            {/* Template cards */}
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDelete={handleDeleteTemplate}
                  onCopy={handleCopyTemplate}
                  onEdit={handleEditTemplate}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailIntelligence;
