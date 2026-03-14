/**
 * University Module - Workbooks Tab
 * Displays companion workbooks generated from PDF books
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { BookOpen, Clock, Layers, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { apiPost, apiDelete } from '@/lib/api';

const WorkbookCard = ({ workbook, onClick, canEdit, onDelete }) => {
  const componentCount = workbook.components?.length || 0;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${workbook.title}"? This cannot be undone.`)) {
      onDelete(workbook.id);
    }
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-zinc-700/50 bg-zinc-800/60"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-orange-500 border-orange-600/30">
              Workbook
            </Badge>
            {workbook.source_book && (
              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600/30">
                Companion
              </Badge>
            )}
          </div>
          {canEdit && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete workbook"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <h3 className="font-semibold text-lg text-white mb-2">{workbook.title}</h3>
        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{workbook.description}</p>

        <div className="flex items-center text-sm text-zinc-500 mb-4 gap-4">
          <div className="flex items-center gap-1">
            <Layers className="w-4 h-4" />
            <span>{componentCount} sections</span>
          </div>
          {workbook.estimated_time && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{workbook.estimated_time}</span>
            </div>
          )}
        </div>

        {workbook.source_book && (
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Based on: {workbook.source_book}</span>
          </div>
        )}

        <div className="flex items-center text-orange-500 text-sm font-medium">
          Open Workbook
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
};

export const WorkbooksTab = ({ workbooks, canEdit, onRefresh }) => {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const handleDelete = async (workbookId) => {
    try {
      const res = await apiDelete(`/api/university/workbooks/${workbookId}`);
      if (res.ok) {
        toast.success('Workbook deleted');
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.error || 'Failed to delete workbook');
      }
    } catch (err) {
      toast.error('Error deleting workbook: ' + err.message);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiPost('/api/university/workbooks/seed');
      if (res.ok) {
        toast.success(`Seeded ${res.data.workbooks_seeded} workbooks`);
        if (onRefresh) onRefresh();
      } else {
        toast.error('Failed to seed workbooks');
      }
    } catch (err) {
      toast.error('Error seeding workbooks: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (!workbooks || workbooks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-500 text-lg mb-2">No workbooks yet</p>
        <p className="text-zinc-600 text-sm mb-6">
          Upload a book to the Library and generate a companion workbook.
        </p>
        {canEdit && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'Seeding...' : 'Load Sample Workbooks'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {workbooks.map((workbook) => (
        <WorkbookCard
          key={workbook.id}
          workbook={workbook}
          canEdit={canEdit}
          onDelete={handleDelete}
          onClick={() => navigate(`/university/workbook/${workbook.id}`)}
        />
      ))}
    </div>
  );
};

export default WorkbooksTab;
