/**
 * University Module - Firm Content Tab Component
 * Manages custom firm-specific content (SOPs, articles, courses)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { 
  Plus, BookOpen, FileText, FileCode, FolderOpen,
  Eye, EyeOff, Trash2
} from 'lucide-react';

const ContentCard = ({ item, type, onTogglePublish, onDelete }) => (
  <Card className="overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            {type === 'document' && (
              <Badge variant="outline" className="text-xs">
                {item.doc_type?.toUpperCase() || 'DOC'}
              </Badge>
            )}
            {item.is_published ? (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Published
              </Badge>
            ) : (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                Draft
              </Badge>
            )}
          </div>
          <h4 className="font-semibold text-gray-900">{item.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">
            {item.description}
          </p>
        </div>
        <div className="flex space-x-1 ml-2">
          <button 
            onClick={() => onTogglePublish(type, item)}
            className="p-1 text-gray-600 hover:text-gray-600:text-gray-300 rounded"
            title={item.is_published ? 'Unpublish' : 'Publish'}
          >
            {item.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => onDelete(type, item.id)}
            className="p-1 text-gray-600 hover:text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </CardContent>
  </Card>
);

const ContentSection = ({ title, icon: Icon, items, type, onTogglePublish, onDelete, iconColor }) => {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <ContentCard 
            key={item.id} 
            item={item} 
            type={type}
            onTogglePublish={onTogglePublish}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export const FirmContentTab = ({ 
  customContent, 
  onCreateClick, 
  onTogglePublish, 
  onDelete 
}) => {
  const hasContent = 
    (customContent.documents?.length > 0) ||
    (customContent.articles?.length > 0) ||
    (customContent.courses?.length > 0);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Firm-Specific Content
          </h2>
          <p className="text-gray-600 text-sm">
            Upload and manage your internal training, SOPs, and strategies
          </p>
        </div>
        <Button 
          className="bg-orange-600 hover:bg-orange-700"
          onClick={onCreateClick}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Content
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="dark:bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Custom Courses</CardTitle>
            </div>
            <CardDescription className="dark:text-gray-600">
              Internal training programs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {customContent.totals?.courses || customContent.courses?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">Custom Articles</CardTitle>
            </div>
            <CardDescription className="dark:text-gray-600">
              Firm-specific guides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {customContent.totals?.articles || customContent.articles?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="dark:bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <FileCode className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Documents</CardTitle>
            </div>
            <CardDescription className="dark:text-gray-600">
              SOPs, templates, strategies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">
              {customContent.totals?.documents || customContent.documents?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Lists */}
      {hasContent ? (
        <div className="space-y-6">
          <ContentSection 
            title="Documents & SOPs"
            icon={FileCode}
            iconColor="text-purple-600"
            items={customContent.documents}
            type="document"
            onTogglePublish={onTogglePublish}
            onDelete={onDelete}
          />
          <ContentSection 
            title="Custom Articles"
            icon={FileText}
            iconColor="text-green-600"
            items={customContent.articles}
            type="article"
            onTogglePublish={onTogglePublish}
            onDelete={onDelete}
          />
          <ContentSection 
            title="Custom Courses"
            icon={BookOpen}
            iconColor="text-blue-600"
            items={customContent.courses}
            type="course"
            onTogglePublish={onTogglePublish}
            onDelete={onDelete}
          />
        </div>
      ) : (
        <Card className="dark:bg-white">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Custom Content Yet
            </h3>
            <p className="text-gray-600 mb-4">
              Add your firm-specific training, SOPs, and strategies
            </p>
            <Button 
              className="bg-orange-600 hover:bg-orange-700" 
              onClick={onCreateClick}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Content
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FirmContentTab;
