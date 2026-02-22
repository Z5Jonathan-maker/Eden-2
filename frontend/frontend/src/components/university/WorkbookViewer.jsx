/**
 * WorkbookViewer - Full page viewer for companion workbooks
 * Renders structured UI components from workbook JSON data
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { ArrowLeft, BookOpen, Clock, ChevronUp } from 'lucide-react';
import WorkbookRenderer from './workbook/WorkbookRenderer';
import { apiGet } from '@/lib/api';

function WorkbookViewer() {
  const { workbookId } = useParams();
  const navigate = useNavigate();
  const [workbook, setWorkbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    fetchWorkbook();
  }, [workbookId]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setProgress(Math.min(100, Math.round((window.scrollY / scrollHeight) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchWorkbook = async () => {
    try {
      const res = await apiGet(`/api/university/workbooks/${workbookId}`);
      if (res.ok) setWorkbook(res.data);
    } catch (err) {
      console.error('Error fetching workbook:', err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading workbook...</p>
        </div>
      </div>
    );
  }

  if (!workbook) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-4">Workbook not found.</p>
            <button
              onClick={() => navigate('/university')}
              className="text-orange-500 hover:text-orange-400 text-sm"
            >
              Back to University
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Fixed progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="sticky top-1 z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/university')}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              University
            </button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{workbook.estimated_time || '30 min'}</span>
              </div>
              <Badge variant="outline" className="text-xs text-orange-500 border-orange-600/30">
                {workbook.category || 'Workbook'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800/80 to-zinc-900 border border-zinc-700/30 p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 to-transparent" />
          <div className="relative">
            {workbook.source_book && (
              <span className="inline-block text-orange-500/70 font-mono text-[10px] tracking-[0.3em] uppercase mb-4">
                Companion Workbook
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
              {workbook.title}
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
              {workbook.description}
            </p>
            {workbook.source_book && (
              <div className="mt-6 flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-500 text-sm">Based on: {workbook.source_book}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <WorkbookRenderer components={workbook.components} />
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 w-10 h-10 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shadow-lg transition-all"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default WorkbookViewer;
