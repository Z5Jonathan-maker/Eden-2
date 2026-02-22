/**
 * LibraryTab — Shared e-book library grid
 *
 * Displays books uploaded by admins, with search/filter, progress bars,
 * and navigation to the full-page BookReader.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, BookOpen, Plus, FileText, Filter,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'sales', label: 'Sales' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'legal', label: 'Legal' },
  { id: 'industry', label: 'Industry' },
  { id: 'other', label: 'Other' },
];

const FORMAT_BADGE = {
  epub: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  pdf:  { bg: 'bg-red-500/20',  text: 'text-red-300',  border: 'border-red-500/30' },
};

const LibraryTab = ({ books = [], loading, onAddClick, canEdit }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = books.filter((b) => {
    if (category !== 'all' && b.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search books..."
            className="w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 font-mono"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Category filter */}
          <div className="flex gap-1 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all border ${
                  category === c.id
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'text-zinc-500 border-zinc-800/40 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Add book (admin only) */}
          {canEdit && (
            <button
              onClick={onAddClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono uppercase bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Book
            </button>
          )}
        </div>
      </div>

      {/* Book Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="spinner-tactical w-10 h-10 mx-auto mb-3" />
          <p className="text-zinc-500 font-mono text-sm">Loading library...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-mono text-zinc-400 mb-2">
            {books.length === 0 ? 'No books yet' : 'No matches'}
          </h3>
          <p className="text-zinc-600 text-sm max-w-md mx-auto">
            {books.length === 0
              ? 'Upload Kindle e-books (EPUB) or PDFs to build your team\'s shared library.'
              : 'Try a different search or category filter.'}
          </p>
          {books.length === 0 && canEdit && (
            <button
              onClick={onAddClick}
              className="mt-4 px-5 py-2 rounded-lg text-sm font-mono uppercase bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-all"
            >
              <Plus className="w-4 h-4 inline mr-1.5" /> Add First Book
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((book) => {
            const fmt = FORMAT_BADGE[book.file_type] || FORMAT_BADGE.epub;
            const pct = book.progress?.percentage || 0;
            return (
              <button
                key={book.id}
                onClick={() => navigate(`/university/library/${book.id}`)}
                className="group text-left bg-zinc-900/60 border border-zinc-800/50 rounded-xl overflow-hidden hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all"
              >
                {/* Cover */}
                <div className="aspect-[2/3] bg-zinc-950/60 flex items-center justify-center relative overflow-hidden">
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-700 group-hover:text-zinc-500 transition-colors">
                      <BookOpen className="w-10 h-10" />
                      <span className="text-[9px] font-mono uppercase tracking-wider">
                        {book.file_type?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Format badge */}
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${fmt.bg} ${fmt.text} border ${fmt.border}`}>
                    {book.file_type}
                  </span>

                  {/* Progress bar */}
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                    {book.author}
                  </p>
                  {pct > 0 && (
                    <p className="text-[10px] text-orange-400/70 font-mono mt-1">
                      {Math.round(pct)}% read
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LibraryTab;
