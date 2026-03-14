/**
 * BookReader — Full-page EPUB + PDF reader
 *
 * Uses react-reader (epub.js) for EPUB files and react-pdf (pdf.js) for PDFs.
 * Saves reading position per-user via /api/university/library/books/:id/progress.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactReader } from 'react-reader';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft, Loader2, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, BookOpen,
} from 'lucide-react';
import { apiGet, apiPut, assertApiUrl, getAuthToken } from '@/lib/api';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BookReader = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState(null);
  const [error, setError] = useState(null);

  // EPUB state
  const [epubLocation, setEpubLocation] = useState(null);

  // PDF state
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);

  // Debounce timer for progress saves
  const saveTimerRef = useRef(null);

  // ── Load book metadata ─────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiGet(`/api/university/library/books/${bookId}`);
        if (!res.ok) throw new Error(res.error || 'Book not found');
        setBook(res.data);

        // Restore saved position
        if (res.data.progress?.position) {
          if (res.data.file_type === 'epub') {
            setEpubLocation(res.data.progress.position);
          } else {
            const page = parseInt(res.data.progress.position, 10);
            if (page > 0) setCurrentPage(page);
          }
        }

        // Fetch the actual file as a blob URL
        const apiUrl = assertApiUrl();
        const token = getAuthToken();
        const fileRes = await fetch(`${apiUrl}/api/uploads/file/${res.data.file_id}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!fileRes.ok) throw new Error('Failed to load book file');

        const blob = await fileRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        setFileUrl(blobUrl);
      } catch (err) {
        console.error('[BookReader] load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => {
      // Cleanup blob URL on unmount
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [bookId]);

  // ── Save progress (debounced) ──────────────────────────────────

  const saveProgress = useCallback(
    (position, percentage) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await apiPut(`/api/university/library/books/${bookId}/progress`, {
            position: String(position),
            percentage: Math.round(percentage * 100) / 100,
          });
        } catch {
          // Silent fail — don't interrupt reading
        }
      }, 1500);
    },
    [bookId],
  );

  // ── EPUB handlers ──────────────────────────────────────────────

  const handleEpubLocationChanged = (cfi) => {
    setEpubLocation(cfi);
    // react-reader doesn't provide percentage directly, estimate from CFI
    // We'll save the CFI as position and percentage can be approximate
    saveProgress(cfi, 0);
  };

  const handleEpubRendition = (rendition) => {
    // Apply dark-friendly theme
    rendition.themes.override('color', '#e4e4e7');
    rendition.themes.override('background', '#18181b');
    rendition.themes.override('font-family', 'Georgia, serif');
    rendition.themes.override('line-height', '1.7');

    // Track percentage from epub.js locations
    rendition.on('relocated', (location) => {
      if (location?.start?.percentage !== undefined) {
        saveProgress(location.start.cfi, location.start.percentage * 100);
      }
    });
  };

  // ── PDF handlers ───────────────────────────────────────────────

  const onPdfLoadSuccess = ({ numPages: n }) => {
    setNumPages(n);
  };

  const goToPage = (page) => {
    const p = Math.max(1, Math.min(numPages || 1, page));
    setCurrentPage(p);
    saveProgress(p, numPages ? (p / numPages) * 100 : 0);
  };

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-400 animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 font-mono text-sm">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-mono mb-4">{error || 'Book not found'}</p>
          <button
            onClick={() => navigate('/university')}
            className="px-4 py-2 rounded-lg text-sm font-mono text-orange-300 border border-orange-500/30 hover:bg-orange-500/10"
          >
            Back to University
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/university')}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-zinc-200 truncate max-w-[50vw]">{book.title}</h1>
            <p className="text-[11px] text-zinc-500 font-mono">{book.author}</p>
          </div>
        </div>

        {/* PDF controls */}
        {book.file_type === 'pdf' && numPages && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPdfScale((s) => Math.max(0.5, s - 0.2))}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-zinc-500">{Math.round(pdfScale * 100)}%</span>
            <button
              onClick={() => setPdfScale((s) => Math.min(3, s + 0.2))}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-zinc-700 mx-1" />

            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-zinc-300 min-w-[60px] text-center">
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* EPUB badge */}
        {book.file_type === 'epub' && (
          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded">
            EPUB
          </span>
        )}
      </div>

      {/* Reader area */}
      <div className="flex-1 relative">
        {!fileUrl ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : book.file_type === 'epub' ? (
          /* ── EPUB Reader ── */
          <div style={{ height: 'calc(100vh - 57px)' }}>
            <ReactReader
              url={fileUrl}
              location={epubLocation}
              locationChanged={handleEpubLocationChanged}
              getRendition={handleEpubRendition}
              epubInitOptions={{ openAs: 'epub' }}
              showToc={true}
              readerStyles={{
                container: { background: '#18181b' },
                readerArea: { background: '#18181b' },
                tocArea: { background: '#27272a' },
                tocButton: { color: '#a1a1aa' },
                tocButtonBar: { background: '#a1a1aa' },
                arrow: { color: '#a1a1aa', fontSize: '28px' },
              }}
            />
          </div>
        ) : (
          /* ── PDF Reader ── */
          <div
            className="overflow-auto flex justify-center py-4"
            style={{ height: 'calc(100vh - 57px)' }}
          >
            <Document
              file={fileUrl}
              onLoadSuccess={onPdfLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                </div>
              }
              error={
                <p className="text-red-400 font-mono text-sm py-20 text-center">
                  Failed to load PDF
                </p>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={pdfScale}
                className="shadow-2xl"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookReader;
