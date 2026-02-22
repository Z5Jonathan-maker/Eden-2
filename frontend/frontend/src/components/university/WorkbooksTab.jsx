/**
 * University Module - Workbooks Tab
 * Displays companion workbooks generated from PDF books
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { BookOpen, Clock, Layers, ChevronRight } from 'lucide-react';

const WorkbookCard = ({ workbook, onClick }) => {
  const componentCount = workbook.components?.length || 0;

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

export const WorkbooksTab = ({ workbooks }) => {
  const navigate = useNavigate();

  if (!workbooks || workbooks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-500 text-lg mb-2">No workbooks yet</p>
        <p className="text-zinc-600 text-sm">
          Upload a book to the Library and generate a companion workbook.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {workbooks.map((workbook) => (
        <WorkbookCard
          key={workbook.id}
          workbook={workbook}
          onClick={() => navigate(`/university/workbook/${workbook.id}`)}
        />
      ))}
    </div>
  );
};

export default WorkbooksTab;
