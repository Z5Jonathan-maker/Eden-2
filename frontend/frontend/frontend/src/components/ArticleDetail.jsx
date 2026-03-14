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
  var [error, setError] = useState('');

  const fetchArticle = useCallback(
    async function fetchArticle() {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet('/api/university/articles/' + articleId);
        if (res.ok) {
          setArticle(res.data);
        } else {
          setError(res.error || 'Failed to load article');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch article');
        console.error('Failed to fetch article:', err);
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
      <div className="p-4 sm:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">
              {error ? 'Failed to load article' : 'Article not found'}
            </h3>
            {error && <p className="text-gray-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 justify-center mt-4">
              <Button
                variant="outline"
                onClick={function () {
                  navigate('/university');
                }}
              >
                Back
              </Button>
              {error && <Button onClick={fetchArticle}>Retry</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen">
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

              <h1 className="text-xl sm:text-3xl font-bold text-zinc-100 mb-4">{article.title}</h1>
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
