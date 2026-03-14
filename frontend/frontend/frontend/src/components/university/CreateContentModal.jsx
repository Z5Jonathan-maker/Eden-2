/**
 * University Module - Create Content Modal
 */

import React from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Textarea } from '../../shared/ui/textarea';
import { Badge } from '../../shared/ui/badge';
import { 
  X, Save, Loader2, Upload, FileText, BookOpen, 
  FolderOpen, File, Image, Video, Music, Paperclip, Trash2
} from 'lucide-react';

const DOC_TYPES = [
  { value: 'sop', label: 'SOP', desc: 'Standard Operating Procedure' },
  { value: 'checklist', label: 'Checklist', desc: 'Step-by-step checklist' },
  { value: 'template', label: 'Template', desc: 'Reusable document template' },
  { value: 'guide', label: 'Guide', desc: 'How-to guide' },
  { value: 'policy', label: 'Policy', desc: 'Company policy document' }
];

const getFileIcon = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-green-500" />;
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return <Video className="w-4 h-4 text-purple-500" />;
  if (['mp3', 'wav', 'ogg'].includes(ext)) return <Music className="w-4 h-4 text-pink-500" />;
  if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-zinc-500" />;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const CreateContentModal = ({
  show,
  onClose,
  createType,
  setCreateType,
  newContent,
  setNewContent,
  attachedFiles,
  setAttachedFiles,
  saving,
  uploadingFile,
  onSave,
  onFileUpload,
  onRemoveFile
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700/50">
          <h2 className="text-xl font-bold text-zinc-100">Create New Content</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Content Type Selection */}
          <div>
            <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Content Type</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                { type: 'article', icon: <FileText className="w-5 h-5" />, label: 'Article' },
                { type: 'course', icon: <BookOpen className="w-5 h-5" />, label: 'Course' },
                { type: 'document', icon: <FolderOpen className="w-5 h-5" />, label: 'Document' }
              ].map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => setCreateType(type)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    createType === type
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-700/50 hover:border-zinc-600'
                  }`}
                >
                  <div className={`flex flex-col items-center gap-2 ${
                    createType === type ? 'text-orange-400' : 'text-zinc-400'
                  }`}>
                    {icon}
                    <span className="font-medium">{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Document Type (only for documents) */}
          {createType === 'document' && (
            <div>
              <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Document Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DOC_TYPES.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setNewContent(prev => ({ ...prev, doc_type: value }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      newContent.doc_type === value
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-zinc-600'
                    }`}
                  >
                    <p className={`font-medium ${newContent.doc_type === value ? 'text-orange-500' : 'text-zinc-200'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-zinc-400">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Title *</Label>
            <Input
              value={newContent.title}
              onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter title..."
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Description</Label>
            <Textarea
              value={newContent.description}
              onChange={(e) => setNewContent(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description..."
              className="mt-2"
              rows={2}
            />
          </div>

          {/* Content (for articles and documents) */}
          {(createType === 'article' || createType === 'document') && (
            <div>
              <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Content</Label>
              <Textarea
                value={newContent.content}
                onChange={(e) => setNewContent(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your content here... (Markdown supported)"
                className="mt-2 font-mono text-sm"
                rows={8}
              />
            </div>
          )}

          {/* Tags */}
          <div>
            <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Tags (comma separated)</Label>
            <Input
              value={newContent.tags}
              onChange={(e) => setNewContent(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., xactimate, beginner, roof"
              className="mt-2"
            />
          </div>

          {/* File Attachments */}
          <div>
            <Label className="text-zinc-400 font-mono text-xs uppercase tracking-wider">Attachments</Label>
            <div className="mt-2 border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-orange-500/40 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={onFileUpload}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  {uploadingFile ? (
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-zinc-600" />
                      <p className="text-zinc-400">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-zinc-600">
                        PDF, Images, Videos up to 50MB
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
            
            {/* Attached Files List */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.filename)}
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{file.filename}</p>
                        <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(i)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-700/50 rounded-lg">
            <div>
              <p className="font-medium text-zinc-200">Publish immediately</p>
              <p className="text-sm text-zinc-500">Make this visible to all team members</p>
            </div>
            <Button
              variant={newContent.is_published ? 'default' : 'outline'}
              onClick={() => setNewContent(prev => ({ ...prev, is_published: !prev.is_published }))}
              className={newContent.is_published ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {newContent.is_published ? 'Published' : 'Draft'}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-zinc-700/50">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onSave}
            disabled={saving || !newContent.title}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create {createType.charAt(0).toUpperCase() + createType.slice(1)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateContentModal;
