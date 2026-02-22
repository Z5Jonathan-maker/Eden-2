/**
 * University Module - Articles Tab Component
 */

import React from 'react';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Input } from '../../shared/ui/input';
import { Search, FileText, Clock } from 'lucide-react';

const ArticleCardItem = ({ article, onClick }) => {
  const readTime = article.read_time || `${Math.ceil((article.content?.length || 500) / 1000)} min read`;

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <Badge variant="outline" className="text-xs">
            {article.category || 'General'}
          </Badge>
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">
          {article.title}
        </h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {article.description || article.content?.substring(0, 150) + '...'}
        </p>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-1" />
          {readTime}
        </div>
      </CardContent>
    </Card>
  );
};

export const ArticlesTab = ({ articles, searchQuery, setSearchQuery, onArticleClick }) => {
  const filteredArticles = searchQuery
    ? articles.filter((a) => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.content || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles;

  return (
    <div>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <ArticleCardItem 
            key={article.id} 
            article={article}
            onClick={() => onArticleClick?.(article)}
          />
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {searchQuery ? 'No articles match your search.' : 'No articles available.'}
        </div>
      )}
    </div>
  );
};

export default ArticlesTab;
