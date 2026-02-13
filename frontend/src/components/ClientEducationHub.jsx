import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Calendar,
  FileText,
  Folder,
  HelpCircle,
  Shield,
  Book,
  MessageCircle,
  ChevronRight,
  Search,
  Send,
  ArrowLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ClientEducationHub = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [myQuestions, setMyQuestions] = useState([]);
  const [showAskQuestion, setShowAskQuestion] = useState(false);
  const [questionForm, setQuestionForm] = useState({ question: '', category: 'general' });
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  const token = localStorage.getItem('eden_token');

  const fetchData = useCallback(async () => {
    try {
      // Get categories
      const catRes = await fetch(`${API_URL}/api/client-education/categories`);
      const catData = await catRes.json();
      setCategories(catData.categories || []);

      // Get all articles
      const artRes = await fetch(`${API_URL}/api/client-education/articles`);
      const artData = await artRes.json();
      setArticles(artData.articles || []);

      // Get glossary
      const glossRes = await fetch(`${API_URL}/api/client-education/glossary`);
      const glossData = await glossRes.json();
      setGlossary(glossData.terms || []);

      // Get my questions if logged in
      if (token) {
        const qRes = await fetch(`${API_URL}/api/client-education/questions/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (qRes.ok) {
          const qData = await qRes.json();
          setMyQuestions(qData.questions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitQuestion = async () => {
    if (!questionForm.question.trim()) return;

    setSubmittingQuestion(true);
    try {
      const params = new URLSearchParams();
      params.append('question', questionForm.question);
      params.append('category', questionForm.category);

      const res = await fetch(`${API_URL}/api/client-education/questions?${params.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setShowAskQuestion(false);
        setQuestionForm({ question: '', category: 'general' });
        fetchData();
      }
    } catch (error) {
      console.error('Error submitting question:', error);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const getCategoryIcon = (iconName) => {
    const icons = {
      calendar: <Calendar className="w-6 h-6" />,
      'file-text': <FileText className="w-6 h-6" />,
      folder: <Folder className="w-6 h-6" />,
      'help-circle': <HelpCircle className="w-6 h-6" />,
      shield: <Shield className="w-6 h-6" />,
      book: <Book className="w-6 h-6" />,
      'message-circle': <MessageCircle className="w-6 h-6" />,
    };
    return icons[iconName] || <FileText className="w-6 h-6" />;
  };

  const filteredGlossary = glossary.filter(
    (term) =>
      term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  // Article Detail View
  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gray-50" data-testid="client-education-article">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setSelectedArticle(null)} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <Card>
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{selectedArticle.title}</h1>
              <Badge variant="outline" className="mb-6">
                {selectedArticle.category}
              </Badge>

              <div className="prose prose-orange max-w-none">
                <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Still have questions? */}
          <Card className="mt-6 bg-orange-50 border-orange-200">
            <CardContent className="p-6">
              <h3 className="font-medium text-orange-800 mb-2">Still have questions?</h3>
              <p className="text-orange-700 text-sm mb-4">
                We are here to help. Send us your question and we will respond within 24 hours.
              </p>
              <Button
                onClick={() => setShowAskQuestion(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Ask a Question
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Category Detail View
  if (selectedCategory) {
    const categoryArticles = articles.filter((a) => a.category === selectedCategory.id);
    const category = categories.find((c) => c.id === selectedCategory.id);

    // Glossary view
    if (selectedCategory.id === 'glossary') {
      return (
        <div className="min-h-screen bg-gray-50" data-testid="client-education-glossary">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <Button variant="ghost" onClick={() => setSelectedCategory(null)} className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Insurance Glossary</h1>
              <p className="text-gray-600">Common terms explained in plain language</p>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 w-5 h-5" />
              <input
                type="text"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-4">
              {filteredGlossary.map((term) => (
                <Card key={term.id}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">{term.term}</h3>
                    <p className="text-gray-600 text-sm">{term.definition}</p>
                    {term.category && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {term.category}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50" data-testid="client-education-category">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setSelectedCategory(null)} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                {getCategoryIcon(category?.icon)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{category?.name}</h1>
                <p className="text-gray-600">{category?.description}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {categoryArticles.map((article) => (
              <Card
                key={article.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedArticle(article)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{article.title}</h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </CardContent>
              </Card>
            ))}

            {categoryArticles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No articles in this category yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Hub View
  return (
    <div className="min-h-screen bg-gray-50" data-testid="client-education-hub">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-3">Client Resource Center</h1>
          <p className="text-orange-100 text-lg">Everything you need to understand your claim</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Categories Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
              onClick={() => setSelectedCategory(category)}
            >
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-4">
                  {getCategoryIcon(category.icon)}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{category.description}</p>
                <Badge variant="outline">{category.count} articles</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Helpful</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {articles.slice(0, 4).map((article) => (
              <Card
                key={article.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedArticle(article)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    {getCategoryIcon(article.icon)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm">{article.title}</h4>
                    <p className="text-xs text-gray-500">{article.category}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* My Questions */}
        {token && (
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Questions</h2>
              <Button
                onClick={() => setShowAskQuestion(true)}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Ask Question
              </Button>
            </div>

            {myQuestions.length > 0 ? (
              <div className="space-y-3">
                {myQuestions.map((q) => (
                  <Card key={q.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-gray-900">{q.question}</p>
                        <Badge variant={q.status === 'answered' ? 'default' : 'outline'}>
                          {q.status}
                        </Badge>
                      </div>
                      {q.answer && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                          <p className="text-sm text-green-800">{q.answer}</p>
                          <p className="text-xs text-green-600 mt-2">
                            Answered by {q.answered_by} •{' '}
                            {new Date(q.answered_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-gray-50">
                <CardContent className="p-6 text-center">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No questions yet. We are here to help!</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Contact Banner */}
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-gray-900">
          <CardContent className="p-6 text-center">
            <h3 className="text-xl font-semibold mb-2">Need More Help?</h3>
            <p className="text-orange-100 mb-4">
              Our team is here to answer any questions about your claim.
            </p>
            <Button
              onClick={() => setShowAskQuestion(true)}
              variant="secondary"
              className="bg-white text-orange-600 hover:bg-orange-50"
            >
              <Send className="w-4 h-4 mr-2" /> Send Us a Question
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ask Question Modal */}
      {showAskQuestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Ask a Question</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={questionForm.category}
                  onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="general">General Question</option>
                  <option value="timeline">Timeline & Process</option>
                  <option value="documents">Documents Needed</option>
                  <option value="policy">Policy Question</option>
                  <option value="payment">Payment/Settlement</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Your Question</label>
                <textarea
                  value={questionForm.question}
                  onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="What would you like to know?"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAskQuestion(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitQuestion}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                disabled={submittingQuestion || !questionForm.question.trim()}
              >
                {submittingQuestion ? 'Sending...' : 'Send Question'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientEducationHub;
