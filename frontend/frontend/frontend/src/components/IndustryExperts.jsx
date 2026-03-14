/**
 * IndustryExperts.jsx - Browsable expert profiles for Doctrine
 * Displays industry thought leaders and their insights
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shared/ui/card';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/tabs';
import { ScrollArea } from '../shared/ui/scroll-area';
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
  TrendingUp,
  Heart,
} from 'lucide-react';
import { apiGet } from '@/lib/api';

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
    case 'Business Growth':
      return <TrendingUp className="w-4 h-4" />;
    case 'Faith & Purpose':
      return <Heart className="w-4 h-4" />;
    default:
      return <BookOpen className="w-4 h-4" />;
  }
};

const getCategoryColor = (category) => {
  const colors = {
    'Roofing & Claims': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    'Public Adjusting': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'Insurance Law': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'Insurance Coverage': 'bg-green-500/15 text-green-400 border-green-500/30',
    'Insurance Appraisal': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    'Public Adjusting Business': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    Leadership: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    'Business Growth': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Faith & Purpose': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
  return colors[category] || 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
};

const IndustryExperts = () => {
  const [experts, setExperts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [selectedExpert, setSelectedExpert] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(null);
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
        apiGet('/api/knowledge-base/experts'),
        apiGet('/api/knowledge-base/mentors'),
      ]);

      if (expertsRes.ok) {
        setExperts(expertsRes.data.experts || []);
      }

      if (mentorsRes.ok) {
        setMentors(mentorsRes.data.mentors || []);
      }
    } catch (err) {
      console.error('Failed to fetch experts:', err);
    }
    setLoading(false);
  };

  const fetchExpertDetail = async (expertId) => {
    try {
      const res = await apiGet(`/api/knowledge-base/experts/${expertId}`);
      if (res.ok) {
        setSelectedExpert(res.data);
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
      const res = await apiGet(`/api/knowledge-base/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        setSearchResults(res.data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const ExpertCard = ({ expert, onClick }) => (
    <Card
      className="cursor-pointer bg-[#1a1a1a] border-zinc-700/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all hover:border-orange-500/30 group"
      onClick={() => onClick(expert.id)}
      data-testid={`expert-card-${expert.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-lg ring-2 ring-orange-500/20 group-hover:ring-orange-500/40 transition-all">
              {expert.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <CardTitle className="text-lg text-white group-hover:text-orange-500 transition-colors">
                {expert.name}
              </CardTitle>
              {expert.alias && <p className="text-sm text-zinc-500 italic">"{expert.alias}"</p>}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-orange-500 transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <Badge className={`${getCategoryColor(expert.category)} mb-3 border`}>
          {getCategoryIcon(expert.category)}
          <span className="ml-1">{expert.category}</span>
        </Badge>
        <p className="text-sm text-zinc-400 line-clamp-3">{expert.bio}</p>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-700/50 text-xs text-zinc-500">
          {expert.books_count > 0 && (
            <span className="flex items-center gap-1">
              <Book className="w-3 h-3 text-blue-400" /> {expert.books_count} books
            </span>
          )}
          {expert.articles_count > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-green-400" /> {expert.articles_count} articles
            </span>
          )}
          {expert.expertise_count > 0 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-yellow-400" /> {expert.expertise_count} areas
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ExpertDetailView = ({ expert }) => (
    <div className="space-y-6" data-testid="expert-detail-view">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 bg-[#1a1a1a] rounded-xl border border-zinc-700/50">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 ring-3 ring-orange-500/20">
          {expert.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{expert.name}</h2>
          {expert.alias && <p className="text-zinc-500 italic">"{expert.alias}"</p>}
          <Badge className={`${getCategoryColor(expert.category)} mt-2 border`}>
            {getCategoryIcon(expert.category)}
            <span className="ml-1">{expert.category}</span>
          </Badge>
          {expert.location && <p className="text-sm text-zinc-500 mt-1">📍 {expert.location}</p>}
        </div>
      </div>

      {/* Bio */}
      <Card className="bg-[#1a1a1a] border-zinc-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-white">
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
        <Card className="bg-[#1a1a1a] border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Areas of Expertise ({expert.expertise.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expert.expertise.map((exp, i) => (
                <Badge key={i} variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                  {exp}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {expert.key_insights && expert.key_insights.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Key Insights
            </CardTitle>
            <CardDescription className="text-zinc-500">Wisdom from {expert.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {expert.key_insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1 font-bold">{i + 1}.</span>
                  <span className="text-zinc-300">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Books */}
      {expert.books && expert.books.length > 0 && (
        <Card className="bg-[#1a1a1a] border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Book className="w-5 h-5 text-blue-400" />
              Books ({expert.books.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expert.books.map((book, i) => (
                <div key={i} className="border border-zinc-700/50 rounded-lg p-4 bg-blue-500/5 hover:border-blue-500/30 transition-colors">
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
                      className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline mt-2"
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
        <Card className="bg-[#1a1a1a] border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-green-400" />
              Articles & Content ({expert.articles.length})
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
        <Card className="bg-[#1a1a1a] border-zinc-700/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Link className="w-5 h-5 text-purple-400" />
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
      {/* Tactical Header */}
      <div className="bg-[#1a1a1a] rounded-xl border border-zinc-700/50 p-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/icons/experts.png"
              alt="Experts"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
              style={{ filter: 'drop-shadow(0 0 12px rgba(249, 115, 22, 0.4))' }}
            />
            <div>
              <h1 className="text-2xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange">
                Industry Experts
              </h1>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest mt-1">
                {experts.length + mentors.length} experts & mentors indexed
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Search experts, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-72 pl-9 bg-zinc-900/50 border-zinc-700/50 focus:border-orange-500/50"
                data-testid="expert-search-input"
              />
            </div>
            <Button onClick={handleSearch} size="icon" variant="outline" className="border-zinc-700/50 hover:border-orange-500/30 hover:bg-orange-500/10">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <Card className="border-orange-500/30 bg-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span>Search Results for "{searchQuery}"</span>
              <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30">
                {searchResults.length} found
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-zinc-500">No results found</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/50 hover:border-orange-500/20 cursor-pointer transition-colors"
                    onClick={() => fetchExpertDetail(result.expert_id)}
                  >
                    <div>
                      <p className="font-medium text-white">{result.name}</p>
                      <p className="text-sm text-zinc-500">{result.category}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.matches.slice(0, 3).map((match, j) => (
                          <Badge key={j} variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                            {match}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30">
                      {result.score}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchResults(null)}
              className="mt-4 text-zinc-400 hover:text-white"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {experts.map((expert) => (
                <ExpertCard key={expert.id} expert={expert} onClick={fetchExpertDetail} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="mentors" className="mt-6">
            {selectedMentor ? (
              <div className="space-y-6" data-testid="mentor-detail-view">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                    {selectedMentor.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedMentor.name}</h2>
                    <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mt-2">
                      {getCategoryIcon(selectedMentor.category)}
                      <span className="ml-1">{selectedMentor.category}</span>
                    </Badge>
                  </div>
                </div>

                {/* Bio */}
                <Card className="bg-[#1a1a1a] border-zinc-700/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <User className="w-5 h-5 text-indigo-400" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-300 leading-relaxed">{selectedMentor.bio}</p>
                    {selectedMentor.relevance && (
                      <p className="text-sm text-indigo-400 mt-3">
                        <strong>Why this matters:</strong> {selectedMentor.relevance}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Key Insights */}
                {selectedMentor.key_insights && selectedMentor.key_insights.length > 0 && (
                  <Card className="bg-[#1a1a1a] border-zinc-700/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Lightbulb className="w-5 h-5 text-yellow-400" />
                        Key Insights ({selectedMentor.key_insights.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedMentor.key_insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <span className="text-indigo-400 font-bold mt-0.5">{i + 1}</span>
                            <p className="text-zinc-300">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Books */}
                {selectedMentor.books && selectedMentor.books.length > 0 && (
                  <Card className="bg-[#1a1a1a] border-zinc-700/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Book className="w-5 h-5 text-blue-400" />
                        Books & Reading ({selectedMentor.books.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedMentor.books.map((book, i) => (
                          <a
                            key={i}
                            href={book.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-zinc-800/30 transition-colors group"
                          >
                            <BookOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                                {book.title}
                              </p>
                              {book.author && <p className="text-sm text-zinc-500">by {book.author}</p>}
                            </div>
                            <ExternalLink className="w-4 h-4 text-zinc-600 ml-auto flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Resources */}
                {selectedMentor.resources && selectedMentor.resources.length > 0 && (
                  <Card className="bg-[#1a1a1a] border-zinc-700/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 text-white">
                        <Link className="w-5 h-5 text-purple-400" />
                        Resources & Links
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectedMentor.resources.map((resource, i) => (
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
                              <p className="font-medium text-white group-hover:text-indigo-400 transition-colors">
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

                <Button variant="outline" onClick={() => setSelectedMentor(null)} className="w-full">
                  ← Back to All Leaders
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentors.map((mentor) => (
                  <Card
                    key={mentor.id}
                    className="cursor-pointer bg-[#1a1a1a] border-zinc-700/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all hover:border-orange-500/30 group"
                    onClick={() => setSelectedMentor(mentor)}
                    data-testid={`mentor-card-${mentor.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-lg ring-2 ring-indigo-500/20 group-hover:ring-indigo-500/40 transition-all">
                            {mentor.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <CardTitle className="text-lg text-white group-hover:text-indigo-400 transition-colors">
                              {mentor.name}
                            </CardTitle>
                            <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mt-1">
                              {mentor.category}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-zinc-400 line-clamp-3">{mentor.bio}</p>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-700/50 text-xs text-zinc-500">
                        {mentor.books && mentor.books.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Book className="w-3 h-3 text-blue-400" /> {mentor.books.length} books
                          </span>
                        )}
                        {mentor.key_insights && mentor.key_insights.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Lightbulb className="w-3 h-3 text-yellow-400" /> {mentor.key_insights.length} insights
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default IndustryExperts;
