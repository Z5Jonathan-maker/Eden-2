/**
 * University Module - Article Card Component
 */

import React from 'react';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Clock, FileText, ChevronRight, Eye } from 'lucide-react';

export const ArticleCard = ({ article, onClick }) => {
  const readTime = article.read_time || article.estimated_time || '5 min read';
  
  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onClick?.(article)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-xl bg-amber-100">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <Badge variant="outline" className="dark:border-gray-300">
            {article.category || 'Article'}
          </Badge>
        </div>
        
        <h3 className="font-bold text-lg mb-2 line-clamp-2">{article.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {article.description || article.excerpt || article.content?.substring(0, 150) + '...'}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {readTime}
            </span>
            {article.views && (
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {article.views}
              </span>
            )}
          </div>
          
          <div className="flex items-center text-orange-600 text-sm font-medium">
            Read
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ArticleCard;
