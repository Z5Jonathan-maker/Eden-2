/**
 * University Module - Create Content Modal
 */

import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
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
  return <File className="w-4 h-4 text-gray-500" />;
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Create New Content</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Content Type Selection */}
          <div>
            <Label className="dark:text-gray-300">Content Type</Label>
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
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`flex flex-col items-center gap-2 ${
                    createType === type ? 'text-orange-600' : 'text-gray-600'
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
              <Label className="dark:text-gray-300">Document Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DOC_TYPES.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setNewContent(prev => ({ ...prev, doc_type: value }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      newContent.doc_type === value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <p className={`font-medium ${newContent.doc_type === value ? 'text-orange-600' : 'dark:text-gray-900'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <Label className="dark:text-gray-300">Title *</Label>
            <Input
              value={newContent.title}
              onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter title..."
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="dark:text-gray-300">Description</Label>
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
              <Label className="dark:text-gray-300">Content</Label>
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
            <Label className="dark:text-gray-300">Tags (comma separated)</Label>
            <Input
              value={newContent.tags}
              onChange={(e) => setNewContent(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., xactimate, beginner, roof"
              className="mt-2"
            />
          </div>

          {/* File Attachments */}
          <div>
            <Label className="dark:text-gray-300">Attachments</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
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
                      <Upload className="w-8 h-8 text-gray-600" />
                      <p className="text-gray-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-600">
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
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.filename)}
                      <div>
                        <p className="text-sm font-medium">{file.filename}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(i)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Publish immediately</p>
              <p className="text-sm text-gray-500">Make this visible to all team members</p>
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
        <div className="flex justify-end gap-3 p-6 border-t">
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
