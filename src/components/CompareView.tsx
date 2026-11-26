import React, { useEffect, useState } from 'react';
import { GitCompare, ArrowLeftRight, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { comparePapers } from '../api/client';
import type { PaperComparisonResult, PaperMetadata } from '../types';
import { PageCitations } from './CitationText';

interface CompareViewProps {
  papers: PaperMetadata[];
  savedComparisons: PaperComparisonResult[];
  initialPaperAId?: string | null;
  onComparisonSaved: (comparison: PaperComparisonResult) => void;
  onOpenPaperPage: (paperId: string) => void;
  onOpenUpload: () => void;
}

export function CompareView({
  papers,
  savedComparisons,
  initialPaperAId,
  onComparisonSaved,
  onOpenPaperPage,
  onOpenUpload,
}: CompareViewProps) {
  const [paperAId, setPaperAId] = useState<string>(
    initialPaperAId || papers[0]?.id || ''
  );
  const [paperBId, setPaperBId] = useState<string>(
    papers.find((p) => p.id !== (initialPaperAId || papers[0]?.id))?.id || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaperComparisonResult | null>(null);

  useEffect(() => {
    if (initialPaperAId && papers.some((p) => p.id === initialPaperAId)) {
      setPaperAId(initialPaperAId);
      if (paperBId === initialPaperAId || !paperBId) {
        const other = papers.find((p) => p.id !== initialPaperAId);
        setPaperBId(other?.id ?? '');
      }
    }
  }, [initialPaperAId, papers, paperBId]);

  useEffect(() => {
    if (!paperAId && papers[0]) setPaperAId(papers[0].id);
    if (!paperBId && papers[1]) setPaperBId(papers[1].id);
  }, [papers, paperAId, paperBId]);

  useEffect(() => {
    const existing = savedComparisons.find(
      (c) => c.paperAId === paperAId && c.paperBId === paperBId
    );
    if (existing) {
      setResult(existing);
    } else {
      setResult(null);
    }
  }, [paperAId, paperBId, savedComparisons]);

  const handleRunCompare = async (force = false) => {
    setError(null);
    if (!paperAId || !paperBId || paperAId === paperBId) {
      setError('Select two different papers from your library to compare.');
      return;
    }
    setLoading(true);
    try {
      const res = await comparePapers(paperAId, paperBId, force);
      setResult(res.comparison);
      onComparisonSaved(res.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare papers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    setPaperAId(paperBId);
    setPaperBId(paperAId);
  };

  if (papers.length < 2) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <GitCompare className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Upload at least 2 papers to compare</h1>
        <p className="text-sm text-slate-600">
          Paper Comparison requires two indexed PDF papers in your library so ResearchMate AI can build a side-by-side matrix.
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
        >
          Upload Another Paper
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Side-by-Side Paper Comparison
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Contrast objectives, methodologies, datasets, quantitative findings, strengths, and limitations across two papers.
        </p>
      </div>

      {/* Selector Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-end">
          <div className="lg:col-span-5 space-y-1.5">
            <label htmlFor="compare-paper-a" className="text-xs font-medium text-slate-600">
              Paper A (Baseline / Reference)
            </label>
            <select
              id="compare-paper-a"
              value={paperAId}
              onChange={(e) => setPaperAId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
            >
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              title="Swap Paper A and Paper B"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-5 space-y-1.5">
            <label htmlFor="compare-paper-b" className="text-xs font-medium text-slate-600">
              Paper B (Comparison Target)
            </label>
            <select
              id="compare-paper-b"
              value={paperBId}
              onChange={(e) => setPaperBId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
            >
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            Every comparison claim cites page numbers from both documents.
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                type="button"
                onClick={() => void handleRunCompare(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleRunCompare(false)}
              disabled={loading || paperAId === paperBId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Comparing Papers...' : 'Compare Papers'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Saved Comparisons Quick Chips */}
      {savedComparisons.length > 0 && !result && (
        <section className="space-y-2.5">
          <h2 className="text-xs font-semibold text-slate-500">Previously Generated Comparisons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedComparisons.map((comp) => (
              <button
                key={`${comp.paperAId}-${comp.paperBId}`}
                type="button"
                onClick={() => {
                  setPaperAId(comp.paperAId);
                  setPaperBId(comp.paperBId);
                  setResult(comp);
                }}
                className="text-left p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-xl transition-colors cursor-pointer space-y-1"
              >
                <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                  A: {comp.paperATitle}
                </div>
                <div className="text-xs font-semibold text-slate-700 line-clamp-1">
                  B: {comp.paperBTitle}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 pt-1">{comp.executiveVerdict}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Comparison Matrix Output */}
      {result && (
        <div className="space-y-6">
          {/* Executive Verdict */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
            <h2 className="text-xs font-semibold text-slate-500">Executive Verdict</h2>
            <p className="text-sm sm:text-[15px] text-slate-800 leading-relaxed">
              {result.executiveVerdict}
            </p>
          </section>

          {/* Matrix Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                    <th className="py-3.5 px-5 w-44">Dimension</th>
                    <th className="py-3.5 px-5">
                      <button
                        type="button"
                        onClick={() => onOpenPaperPage(result.paperAId)}
                        className="text-left hover:text-blue-600 cursor-pointer"
                      >
                        Paper A: {result.paperATitle}
                      </button>
                    </th>
                    <th className="py-3.5 px-5">
                      <button
                        type="button"
                        onClick={() => onOpenPaperPage(result.paperBId)}
                        className="text-left hover:text-blue-600 cursor-pointer"
                      >
                        Paper B: {result.paperBTitle}
                      </button>
                    </th>
                    <th className="py-3.5 px-5 w-64">Comparative Synthesis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-[13px]">
                  {result.dimensions.map((dim, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50/50">
                      <td className="py-4 px-5 font-semibold text-slate-900">
                        {dim.dimension}
                      </td>
                      <td className="py-4 px-5 text-slate-700 space-y-2">
                        <p className="leading-relaxed">{dim.paperAPoint}</p>
                        <PageCitations pages={dim.paperAPages} prefix="A, p." />
                      </td>
                      <td className="py-4 px-5 text-slate-700 space-y-2">
                        <p className="leading-relaxed">{dim.paperBPoint}</p>
                        <PageCitations pages={dim.paperBPages} prefix="B, p." />
                      </td>
                      <td className="py-4 px-5 text-slate-600 leading-relaxed">
                        {dim.synthesis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Similarities, Differences & Recommendation */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Shared Themes &amp; Similarities</h3>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-[13px] text-slate-700">
                {result.similarities.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Key Architectural Differences</h3>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-[13px] text-slate-700">
                {result.keyDifferences.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Practical Recommendation (When to Choose Each)
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{result.recommendation}</p>
          </section>
        </div>
      )}
    </div>
  );
}
