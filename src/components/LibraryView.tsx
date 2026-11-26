import React, { useMemo, useState } from 'react';
import {
  Search,
  FilePlus2,
  BookOpen,
  Trash2,
  Download,
  GitCompare,
  GraduationCap,
} from 'lucide-react';
import type { PaperMetadata } from '../types';

interface LibraryViewProps {
  papers: PaperMetadata[];
  activePaperId: string | null;
  onOpenUpload: () => void;
  onOpenPaper: (paperId: string, initialAiTab?: 'chat' | 'summary' | 'extract') => void;
  onOpenToolsForPaper: (paperId: string) => void;
  onStartCompareWith: (paperId: string) => void;
  onDeletePaper: (paperId: string) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryView({
  papers,
  activePaperId,
  onOpenUpload,
  onOpenPaper,
  onOpenToolsForPaper,
  onStartCompareWith,
  onDeletePaper,
}: LibraryViewProps) {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const domains = useMemo(() => {
    const set = new Set<string>(['All']);
    papers.forEach((p) => set.add(p.domain));
    return Array.from(set);
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return papers.filter((p) => {
      const domainMatch = selectedDomain === 'All' || p.domain === selectedDomain;
      if (!domainMatch) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.domain.toLowerCase().includes(q) ||
        p.abstractSnippet.toLowerCase().includes(q)
      );
    });
  }, [papers, search, selectedDomain]);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeletePaper(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paper Library</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage uploaded PDF papers, inspect metadata, or launch reading and study tools.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <FilePlus2 className="w-4 h-4" />
          Upload Paper
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by paper title, author, domain, or abstract..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {domains.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => setSelectedDomain(domain)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedDomain === domain
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Paper List */}
      {filteredPapers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            {papers.length === 0 ? 'No papers uploaded yet' : 'No matching papers found'}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {papers.length === 0
              ? 'Upload a PDF research paper to extract page-indexed text and start asking questions.'
              : 'Try clearing your search filter or uploading a new PDF research paper.'}
          </p>
          <div className="pt-2">
            {papers.length === 0 ? (
              <button
                type="button"
                onClick={onOpenUpload}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Upload PDF Paper
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedDomain('All');
                }}
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPapers.map((paper) => {
            const isSelected = paper.id === activePaperId;
            return (
              <article
                key={paper.id}
                className={`bg-white border rounded-xl p-6 flex flex-col justify-between transition-colors ${
                  isSelected ? 'border-blue-500' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Quiet unboxed metadata line */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{paper.domain}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{paper.year}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{paper.totalPages} pages</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {paper.wordCount.toLocaleString()} words
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatBytes(paper.fileSize)}</span>
                  </div>

                  <h2 className="text-base font-semibold text-slate-900 leading-snug">
                    {paper.title}
                  </h2>

                  <p className="text-xs text-slate-500">{paper.authors}</p>

                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                    {paper.abstractSnippet}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-5 mt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPaper(paper.id, 'chat')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Read &amp; Ask AI
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenToolsForPaper(paper.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Viva &amp; Gaps
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCompareWith(paper.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      Compare
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/papers/${encodeURIComponent(paper.id)}/pdf`}
                      download={paper.fileName}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    {confirmDeleteId === paper.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleConfirmDelete(paper.id)}
                          disabled={deletingId === paper.id}
                          className="px-2.5 py-1 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === paper.id ? 'Removing...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(paper.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete paper"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
