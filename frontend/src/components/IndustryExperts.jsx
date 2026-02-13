/**
 * IndustryExperts.jsx - Browsable expert profiles for Doctrine
 * Displays industry thought leaders and their insights
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import {
  User,
  Book,
  FileText,
  Link,
  ExternalLink,
  Search,
  Lightbulb,
  Award,
  Youtube,
  Globe,
  Linkedin,
  ChevronRight,
  BookOpen,
  Briefcase,
  Scale,
  Home,
  Sparkles,
} from 'lucide-react';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Roofing & Claims':
      return <Home className="w-4 h-4" />;
    case 'Public Adjusting':
      return <Briefcase className="w-4 h-4" />;
    case 'Insurance Law':
      return <Scale className="w-4 h-4" />;
    case 'Insurance Coverage':
      return <FileText className="w-4 h-4" />;
    case 'Insurance Appraisal':
      return <Award className="w-4 h-4" />;
    case 'Public Adjusting Business':
      return <Sparkles className="w-4 h-4" />;
    case 'Leadership':
      return <User className="w-4 h-4" />;
    default:
      return <BookOpen className="w-4 h-4" />;
  }
};

const getCategoryColor = (category) => {
  const colors = {
    'Roofing & Claims': 'bg-orange-100 text-orange-700 border-orange-200',
    'Public Adjusting': 'bg-blue-100 text-blue-700 border-blue-200',
    'Insurance Law': 'bg-purple-100 text-purple-700 border-purple-200',
    'Insurance Coverage': 'bg-green-100 text-green-700 border-green-200',
    'Insurance Appraisal': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Public Adjusting Business': 'bg-pink-100 text-pink-700 border-pink-200',
    Leadership: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  };
  return colors[category] || 'bg-gray-100 text-zinc-300 border-gray-200';
};

const IndustryExperts = () => {
  const [experts, setExperts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('experts');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expertsRes, mentorsRes] = await Promise.all([
        fetch(`${API_URL}/api/knowledge-base/experts`),
        fetch(`${API_URL}/api/knowledge-base/mentors`),
      ]);

      if (expertsRes.ok) {
        const data = await expertsRes.json();
        setExperts(data.experts || []);
      }

      if (mentorsRes.ok) {
        const data = await mentorsRes.json();
        setMentors(data.mentors || []);
      }
    } catch (err) {
      console.error('Failed to fetch experts:', err);
    }
    setLoading(false);
  };

  const fetchExpertDetail = async (expertId) => {
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base/experts/${expertId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedExpert(data);
      }
    } catch (err) {
      console.error('Failed to fetch expert detail:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/knowledge-base/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const ExpertCard = ({ expert, onClick }) => (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:border-orange-300 group"
      onClick={() => onClick(expert.id)}
      data-testid={`expert-card-${expert.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
              {expert.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <CardTitle className="text-lg group-hover:text-orange-600 transition-colors">
                {expert.name}
              </CardTitle>
              {expert.alias && <p className="text-sm text-zinc-500 italic">"{expert.alias}"</p>}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <Badge className={`${getCategoryColor(expert.category)} mb-3`}>
          {getCategoryIcon(expert.category)}
          <span className="ml-1">{expert.category}</span>
        </Badge>
        <p className="text-sm text-zinc-400 line-clamp-3">{expert.bio}</p>
        <div className="flex gap-4 mt-3 text-xs text-zinc-500">
          {expert.books_count > 0 && (
            <span className="flex items-center gap-1">
              <Book className="w-3 h-3" /> {expert.books_count} books
            </span>
          )}
          {expert.articles_count > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {expert.articles_count} articles
            </span>
          )}
          {expert.expertise_count > 0 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> {expert.expertise_count} areas
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ExpertDetailView = ({ expert }) => (
    <div className="space-y-6" data-testid="expert-detail-view">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
          {expert.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{expert.name}</h2>
          {expert.alias && <p className="text-zinc-500 italic">"{expert.alias}"</p>}
          <Badge className={`${getCategoryColor(expert.category)} mt-2`}>
            {getCategoryIcon(expert.category)}
            <span className="ml-1">{expert.category}</span>
          </Badge>
          {expert.location && <p className="text-sm text-zinc-500 mt-1">📍 {expert.location}</p>}
        </div>
      </div>

      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Biography
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-300 leading-relaxed">{expert.bio}</p>
        </CardContent>
      </Card>

      {/* Expertise Areas */}
      {expert.expertise && expert.expertise.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Areas of Expertise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expert.expertise.map((exp, i) => (
                <Badge key={i} variant="outline" className="bg-yellow-50 border-yellow-200">
                  {exp}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {expert.key_insights && expert.key_insights.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Key Insights
            </CardTitle>
            <CardDescription>Wisdom from {expert.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {expert.key_insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span className="text-zinc-300">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Books */}
      {expert.books && expert.books.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Book className="w-5 h-5 text-blue-500" />
              Books
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expert.books.map((book, i) => (
                <div key={i} className="border rounded-lg p-4 bg-blue-50/30">
                  <h4 className="font-semibold text-white">{book.title}</h4>
                  {book.coauthor && <p className="text-sm text-zinc-500">with {book.coauthor}</p>}
                  {book.excerpt && (
                    <p className="text-sm text-zinc-400 mt-2 italic">"{book.excerpt}"</p>
                  )}
                  {book.url && (
                    <a
                      href={book.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                    >
                      <ExternalLink className="w-3 h-3" /> View on Amazon
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Articles & Content */}
      {expert.articles && expert.articles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              Articles & Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expert.articles.map((article, i) => (
                <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-start gap-2">
                    {article.type === 'video' ? (
                      <Youtube className="w-4 h-4 text-red-500 mt-1 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                    )}
                    <div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:text-orange-600 transition-colors"
                      >
                        {article.title}
                      </a>
                      {article.excerpt && (
                        <p className="text-sm text-zinc-400 mt-1">{article.excerpt}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {expert.resources && expert.resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-500" />
              Resources & Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {expert.resources.map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-zinc-800/30 transition-colors group"
                >
                  {resource.type === 'YouTube' ? (
                    <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : resource.type === 'LinkedIn' ? (
                    <Linkedin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Globe className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-white group-hover:text-orange-600 transition-colors">
                      {resource.type}
                    </p>
                    <p className="text-sm text-zinc-400">{resource.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={() => setSelectedExpert(null)} className="w-full">
        ← Back to All Experts
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 page-enter" data-testid="industry-experts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-tactical font-bold text-white flex items-center gap-2 tracking-wide">
            <img
              src="/icons/experts.png"
              alt="Experts"
              className="w-10 h-10 object-contain icon-3d-shadow"
            />
            Industry Experts
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
            Learn from the best in public adjusting
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search experts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
            data-testid="expert-search-input"
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg">Search Results for "{searchQuery}"</CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-zinc-500">No results found</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => fetchExpertDetail(result.expert_id)}
                  >
                    <div>
                      <p className="font-medium">{result.name}</p>
                      <p className="text-sm text-zinc-500">{result.category}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.matches.slice(0, 3).map((match, j) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {match}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700">Score: {result.score}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchResults(null)}
              className="mt-4"
            >
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedExpert ? (
        <ExpertDetailView expert={selectedExpert} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="experts" data-testid="tab-experts">
              <Briefcase className="w-4 h-4 mr-2" />
              Industry Experts ({experts.length})
            </TabsTrigger>
            <TabsTrigger value="mentors" data-testid="tab-mentors">
              <User className="w-4 h-4 mr-2" />
              Leadership Mentors ({mentors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="experts" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {experts.map((expert) => (
                <ExpertCard key={expert.id} expert={expert} onClick={fetchExpertDetail} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mentors" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {mentors.map((mentor) => (
                <Card
                  key={mentor.id}
                  className="hover:shadow-lg transition-all hover:border-indigo-300"
                  data-testid={`mentor-card-${mentor.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                        {mentor.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <CardTitle>{mentor.name}</CardTitle>
                        <Badge className="bg-indigo-100 text-indigo-700 mt-1">
                          {mentor.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-zinc-400">{mentor.bio}</p>

                    {mentor.relevance && (
                      <p className="text-sm text-indigo-600">
                        <strong>Relevance:</strong> {mentor.relevance}
                      </p>
                    )}

                    {mentor.books && mentor.books.length > 0 && (
                      <div>
                        <p className="font-medium text-sm text-zinc-300 mb-2">Key Books:</p>
                        {mentor.books.map((book, i) => (
                          <div key={i} className="text-sm">
                            <a
                              href={book.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {book.title}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {mentor.key_insights && mentor.key_insights.length > 0 && (
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <p className="font-medium text-sm text-indigo-700 mb-2">Key Insights:</p>
                        <ul className="space-y-1">
                          {mentor.key_insights.map((insight, i) => (
                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                              <span className="text-indigo-500">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default IndustryExperts;
