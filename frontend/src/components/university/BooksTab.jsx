/**
 * University Module - Books Library Tab
 * Upload and track progress on internal books/manuals
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Textarea } from '../../shared/ui/textarea';
import { Badge } from '../../shared/ui/badge';
import { Progress } from '../../shared/ui/progress';
import { toast } from 'sonner';
import {
  BookOpen,
  Upload,
  CheckCircle,
  Download,
  AlertTriangle
} from 'lucide-react';
import { API_URL } from '@/lib/api';

const formatFileType = (fileName, fileFormat) => {
  if (fileFormat) return fileFormat.toUpperCase();
  if (!fileName) return 'FILE';
  const ext = fileName.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
};

const BookCard = ({ book, onUpdateProgress, onMarkComplete }) => {
  const [progressValue, setProgressValue] = useState(book.progress_percent || 0);
  const isCompleted = book.is_completed || book.progress_percent >= 100;
  const isPdf = (book.file_name || '').toLowerCase().endsWith('.pdf');

  const handleOpen = () => {
    if (!book.file_url) {
      toast.error('No file available for this book');
      return;
    }
    window.open(`${API_URL}${book.file_url}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {formatFileType(book.file_name, book.file_format)}
              </Badge>
              {book.is_mandatory && (
                <Badge className="bg-red-100 text-red-700 text-xs">
                  Mandatory
                </Badge>
              )}
              {isCompleted && (
                <Badge className="bg-green-100 text-green-700 text-xs">
                  Completed
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg text-gray-900">{book.title}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{book.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {book.author && (
          <p className="text-xs text-gray-500 mb-3">Author: {book.author}</p>
        )}
        <div className="space-y-3">
          <Progress value={book.progress_percent || 0} className="h-2" />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{book.progress_percent || 0}% complete</span>
            <button
              onClick={handleOpen}
              className="inline-flex items-center gap-1 text-orange-600 hover:opacity-80"
            >
              {isPdf ? <BookOpen className="w-3 h-3" /> : <Download className="w-3 h-3" />}
              {isPdf ? 'Open' : 'Download'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Input
            type="number"
            min={0}
            max={100}
            value={progressValue}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const safe = Number.isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
              setProgressValue(safe);
            }}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => onUpdateProgress(book.id, progressValue)}
          >
            Update Progress
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onMarkComplete(book.id)}
            disabled={isCompleted}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Mark Complete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const BooksTab = ({
  books,
  canEdit,
  onCreateBook,
  uploading,
  onUpdateProgress,
  onMarkComplete
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    author: '',
    tags: '',
    is_mandatory: false,
    is_published: false
  });
  const [file, setFile] = useState(null);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Book title is required');
      return;
    }
    if (!file) {
      toast.error('Please upload a book file');
      return;
    }

    await onCreateBook({
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    }, file);

    setFormData({
      title: '',
      description: '',
      author: '',
      tags: '',
      is_mandatory: false,
      is_published: false
    });
    setFile(null);
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-600" />
              Upload Book
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Book title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <Input
                placeholder="Author (optional)"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
            </div>
            <Textarea
              placeholder="Short description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <Input
              placeholder="Tags (comma separated)"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="file"
                accept=".pdf,.epub,.mobi,.azw,.azw3"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                  />
                  Mandatory
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  />
                  Published
                </label>
              </div>
            </div>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleSubmit}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Add Book'}
            </Button>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Upload DRM-free PDF, EPUB, or MOBI files only.
            </p>
          </CardContent>
        </Card>
      )}

      {books.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No books in the library yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onUpdateProgress={onUpdateProgress}
              onMarkComplete={onMarkComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BooksTab;
