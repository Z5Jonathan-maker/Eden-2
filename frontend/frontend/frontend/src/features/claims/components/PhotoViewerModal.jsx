import React from 'react';
import { Dialog, DialogContent } from '../../../shared/ui/dialog';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { X, Download } from 'lucide-react';
import SecureImage from '../../../components/SecureImage';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

const PhotoViewerModal = ({ photo, onClose }) => {
  if (!photo) return null;

  return (
    <Dialog open={!!photo} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Image */}
          <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[70vh]">
            <SecureImage
              src={`${API_URL}/api/inspections/photos/${photo.id}/image`}
              alt={photo.room || 'Inspection photo'}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>

          {/* Photo Details */}
          <div className="p-4 bg-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {photo.room || 'Inspection Photo'}
                </h3>
                {photo.category && (
                  <p className="text-sm text-gray-500">{photo.category}</p>
                )}
                {photo.created_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Captured {new Date(photo.created_at).toLocaleString()}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${API_URL}/api/inspections/photos/${photo.id}/image`}
                  download={`photo-${photo.id}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>

            {/* Voice Transcript */}
            {photo.voice_transcript && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3 h-3 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-purple-700">Voice Note</span>
                </div>
                <p className="text-sm text-gray-700">{photo.voice_transcript}</p>
              </div>
            )}

            {/* AI Tags */}
            {photo.ai_tags && photo.ai_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {photo.ai_tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Evidence Chain Metadata */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
              {photo.captured_at && (
                <div>
                  <span className="font-medium text-gray-600">Captured:</span>{' '}
                  {new Date(photo.captured_at).toLocaleString()}
                </div>
              )}
              {photo.latitude && photo.longitude && (
                <div>
                  <span className="font-medium text-gray-600">GPS:</span>{' '}
                  {Number(photo.latitude).toFixed(5)}, {Number(photo.longitude).toFixed(5)}
                </div>
              )}
              {photo.uploaded_by_name && (
                <div>
                  <span className="font-medium text-gray-600">Uploaded by:</span>{' '}
                  {photo.uploaded_by_name}
                </div>
              )}
            </div>

            {/* SHA-256 Verification Hash */}
            {photo.sha256_hash && (
              <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase text-gray-500 font-medium">SHA-256 Hash</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(photo.sha256_hash);
                    }}
                    className="text-[10px] text-blue-500 hover:text-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] font-mono text-gray-400 break-all">{photo.sha256_hash}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoViewerModal;
