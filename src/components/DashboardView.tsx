import React from 'react';
import {
  BookOpen,
  FilePlus2,
  GitCompare,
  GraduationCap,
  ArrowRight,
  MessageSquare,
  Layers,
  Compass,
} from 'lucide-react';
import type { PaperMetadata, WorkspaceTab } from '../types';

interface DashboardViewProps {
  papers: PaperMetadata[];
  activePaperId: string | null;
  comparisonsCount: number;
  onOpenUpload: () => void;
  onOpenPaper: (paperId: string, initialAiTab?: 'chat' | 'summary' | 'extract') => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

export function DashboardView({
  papers,
  activePaperId,
  comparisonsCount,
  onOpenUpload,
  onOpenPaper,
  onNavigate,
}: DashboardViewProps) {
  const totalPages = papers.reduce((acc, p) => acc + p.totalPages, 0);
  const totalWords = papers.reduce((acc, p) => acc + p.wordCount, 0);
  const activePaper = papers.find((p) => p.id === activePaperId) ?? papers[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10">
      {/* Primary Workspace Header & Dominant Anchor */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-3">
            <p className="text-xs font-medium text-blue-600 tracking-wide">
              Academic Paper Intelligence Workspace
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Understand research papers faster with page-cited answers
            </h1>
            <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-2xl">
              Upload any PDF paper to read alongside grounded AI Q&amp;A, generate plain-language
              summaries, extract methodology and datasets, compare papers side-by-side, and prepare
              for viva exams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4" />
              Upload PDF Paper
            </button>
            {activePaper && (
              <button
                type="button"
                onClick={() => onOpenPaper(activePaper.id, 'chat')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4" />
                Open Active Paper
              </button>
            )}
          </div>
        </div>

        {/* Active Paper Quick Resume */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          {activePaper ? (
            <>
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-slate-500">
                  Selected Paper · {activePaper.domain}
                </div>
                <h2 className="text-base font-semibold text-slate-900 leading-snug line-clamp-3">
                  {activePaper.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {activePaper.authors} · <span className="tabular-nums">{activePaper.totalPages} pages</span>
                </p>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 pt-1">
                  {activePaper.abstractSnippet}
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenPaper(activePaper.id, 'summary')}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  Summarize &amp; Read
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPaper(activePaper.id, 'extract')}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Extract Insights
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start justify-center h-full space-y-3">
              <p className="text-sm font-medium text-slate-900">No papers indexed yet</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload your first PDF paper to unlock the split PDF reader, AI Q&amp;A, and viva
                preparation tools.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4-Column Tabular KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl bg-white divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Papers in Library</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {papers.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Ready for grounded Q&amp;A</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Indexed PDF Pages</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalPages}
          </div>
          <div className="mt-1 text-xs text-slate-500">Page-level citation anchors</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Words Processed</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalWords.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">Full-text searchable pages</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500">Saved Comparisons</div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {comparisonsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Side-by-side matrices</div>
        </div>
      </section>

      {/* Core Workflows Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Research Workflows</h2>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View all papers
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => activePaper && onOpenPaper(activePaper.id, 'chat')}
            disabled={!activePaper}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <MessageSquare className="w-5 h-5 text-blue-600 mb-3" />
            <div className="text-sm font-semibold text-slate-900">Grounded AI Chat</div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Ask specific questions and jump directly to cited pages inside the PDF reader.
            </p>
          </button>

          <button
            type="button"
            onClick={() => activePaper && onOpenPaper(activePaper.id, 'extract')}
            disabled={!activePaper}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-5 h-5 text-blue-600 mb-3" />
            <div className="text-sm font-semibold text-slate-900">Structured Extraction</div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Extract methodology, datasets, key metrics, limitations, and conclusions in one click.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('compare')}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors cursor-pointer"
          >
            <GitCompare className="w-5 h-5 text-blue-600 mb-3" />
            <div className="text-sm font-semibold text-slate-900">Compare Two Papers</div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Contrast architectures, benchmarks, strengths, and trade-offs side by side.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors cursor-pointer"
          >
            <GraduationCap className="w-5 h-5 text-blue-600 mb-3" />
            <div className="text-sm font-semibold text-slate-900">Viva, MCQs &amp; Gaps</div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Practice oral defense questions, take grounded MCQ quizzes, and uncover research gaps.
            </p>
          </button>
        </div>
      </section>

      {/* Recent Papers Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Library Documents</h2>
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            Explore Research Tools
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {papers.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-900">Your paper library is empty</p>
              <p className="text-xs text-slate-500">
                Upload a PDF research paper to start reading and analyzing.
              </p>
              <button
                type="button"
                onClick={onOpenUpload}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Upload First Paper
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 px-5">Paper Title &amp; Authors</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4 text-right">Pages</th>
                    <th className="py-3 px-4 text-right">Added</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {papers.slice(0, 6).map((paper) => (
                    <tr key={paper.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 max-w-md">
                        <div className="font-medium text-slate-900 truncate">{paper.title}</div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {paper.authors}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {paper.domain}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 text-right font-mono tabular-nums whitespace-nowrap">
                        {paper.totalPages}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 text-right tabular-nums whitespace-nowrap">
                        {formatDateShort(paper.uploadedAt)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenPaper(paper.id, 'chat')}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          Open Studio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
