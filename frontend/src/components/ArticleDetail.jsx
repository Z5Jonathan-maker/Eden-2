import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { ArrowLeft, User, Calendar, Tag, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api';

function ArticleDetail() {
  var params = useParams();
  var articleId = params.articleId;
  var navigate = useNavigate();
  var [article, setArticle] = useState(null);
  var [loading, setLoading] = useState(true);

  const fetchArticle = useCallback(
    async function fetchArticle() {
      setLoading(true);
      try {
        const res = await apiGet('/api/university/articles/' + articleId);
        if (res.ok) {
          setArticle(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch article:', error);
      } finally {
        setLoading(false);
      }
    },
    [articleId]
  );

  useEffect(
    function () {
      fetchArticle();
    },
    [fetchArticle]
  );

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">Article not found</h3>
            <Button
              className="mt-4"
              onClick={function () {
                navigate('/university');
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={function () {
            navigate('/university');
          }}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to University
        </Button>

        <Card>
          <CardContent className="p-8">
            <div className="mb-8">
              <Badge variant="outline" className="mb-4">
                {article.category === 'training' ? 'Training' : 'Industry'}
              </Badge>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
              <p className="text-lg text-gray-600 mb-4">{article.description}</p>

              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {article.author}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(article.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none whitespace-pre-wrap">{article.content}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ArticleDetail;
