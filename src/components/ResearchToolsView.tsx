import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  XCircle,
  Compass,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  fetchOrGenerateGaps,
  fetchOrGenerateMcqs,
  fetchOrGenerateViva,
} from '../api/client';
import type { PaperAnalysisBundle, PaperMetadata } from '../types';
import { PageCitations } from './CitationText';

interface ResearchToolsViewProps {
  papers: PaperMetadata[];
  activePaperId: string | null;
  analysis: PaperAnalysisBundle | null;
  loadingAnalysis: boolean;
  onSelectPaper: (paperId: string) => void;
  onAnalysisUpdate: (updated: PaperAnalysisBundle) => void;
  onOpenPaperInReader: (paperId: string) => void;
  onOpenUpload: () => void;
}

export function ResearchToolsView({
  papers,
  activePaperId,
  analysis,
  loadingAnalysis,
  onSelectPaper,
  onAnalysisUpdate,
  onOpenPaperInReader,
  onOpenUpload,
}: ResearchToolsViewProps) {
  const [toolTab, setToolTab] = useState<'viva' | 'mcq' | 'gaps'>('viva');

  // Viva state
  const [focusTopic, setFocusTopic] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [revealedVivaIds, setRevealedVivaIds] = useState<Record<string, boolean>>({});
  const [loadingViva, setLoadingViva] = useState(false);
  const [vivaError, setVivaError] = useState<string | null>(null);

  // MCQ state
  const [mcqCount, setMcqCount] = useState<number>(6);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [loadingMcq, setLoadingMcq] = useState(false);
  const [mcqError, setMcqError] = useState<string | null>(null);

  // Gaps state
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  useEffect(() => {
    setRevealedVivaIds({});
    setSelectedOptions({});
    setQuizSubmitted(false);
    setVivaError(null);
    setMcqError(null);
    setGapsError(null);
  }, [activePaperId]);

  const activeMeta = papers.find((p) => p.id === activePaperId) ?? papers[0];

  const handleGenerateViva = async (force = false) => {
    if (!activeMeta || !analysis) return;
    setVivaError(null);
    setLoadingViva(true);
    try {
      const res = await fetchOrGenerateViva(activeMeta.id, focusTopic, force);
      setRevealedVivaIds({});
      onAnalysisUpdate({
        ...analysis,
        vivaQuestions: res.vivaQuestions,
      });
    } catch (err) {
      setVivaError(err instanceof Error ? err.message : 'Failed to generate viva questions.');
    } finally {
      setLoadingViva(false);
    }
  };

  const handleGenerateMcqs = async (force = false) => {
    if (!activeMeta || !analysis) return;
    setMcqError(null);
    setLoadingMcq(true);
    try {
      const res = await fetchOrGenerateMcqs(activeMeta.id, mcqCount, force);
      setSelectedOptions({});
      setQuizSubmitted(false);
      onAnalysisUpdate({
        ...analysis,
        mcqs: res.mcqs,
      });
    } catch (err) {
      setMcqError(err instanceof Error ? err.message : 'Failed to generate MCQ quiz.');
    } finally {
      setLoadingMcq(false);
    }
  };

  const handleGenerateGaps = async (force = false) => {
    if (!activeMeta || !analysis) return;
    setGapsError(null);
    setLoadingGaps(true);
    try {
      const res = await fetchOrGenerateGaps(activeMeta.id, force);
      onAnalysisUpdate({
        ...analysis,
        researchGaps: res.researchGaps,
      });
    } catch (err) {
      setGapsError(err instanceof Error ? err.message : 'Failed to analyze research gaps.');
    } finally {
      setLoadingGaps(false);
    }
  };

  if (papers.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Upload a paper to unlock Research Tools</h1>
        <p className="text-sm text-slate-600">
          Generate oral viva questions, take paper-grounded MCQ quizzes, and identify research gaps once a PDF is uploaded.
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
        >
          Upload PDF Paper
        </button>
      </div>
    );
  }

  const vivaList = analysis?.vivaQuestions ?? [];
  const filteredViva =
    difficultyFilter === 'All'
      ? vivaList
      : vivaList.filter((q) => q.difficulty === difficultyFilter);

  const mcqList = analysis?.mcqs ?? [];
  const answeredCount = mcqList.filter((q) => selectedOptions[q.id] !== undefined).length;
  const correctCount = mcqList.filter(
    (q) => selectedOptions[q.id] === q.correctIndex
  ).length;

  const researchGaps = analysis?.researchGaps;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Header & Paper Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Research &amp; Exam Prep Tools
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Prepare for thesis viva defense, test comprehension with MCQs, and map future research gaps.
          </p>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <label htmlFor="tools-paper-select" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Target Paper:
          </label>
          <select
            id="tools-paper-select"
            value={activeMeta?.id ?? ''}
            onChange={(e) => onSelectPaper(e.target.value)}
            className="text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 max-w-md w-full truncate focus:outline-none focus:border-blue-500"
          >
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tool Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setToolTab('viva')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              toolTab === 'viva'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Viva Questions
          </button>
          <button
            type="button"
            onClick={() => setToolTab('mcq')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              toolTab === 'mcq'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            MCQ Quiz
          </button>
          <button
            type="button"
            onClick={() => setToolTab('gaps')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              toolTab === 'gaps'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            Research Gaps &amp; Future Work
          </button>
        </div>

        {activeMeta && (
          <button
            type="button"
            onClick={() => onOpenPaperInReader(activeMeta.id)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 cursor-pointer whitespace-nowrap"
          >
            Open in PDF Reader
          </button>
        )}
      </div>

      {loadingAnalysis || !analysis ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Loading paper analysis...
        </div>
      ) : (
        <>
          {/* TOOL 1: VIVA QUESTIONS */}
          {toolTab === 'viva' && (
            <section className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="viva-focus" className="text-xs font-medium text-slate-600">
                    Optional Topic Focus (leave blank for full-paper coverage)
                  </label>
                  <input
                    id="viva-focus"
                    type="text"
                    value={focusTopic}
                    onChange={(e) => setFocusTopic(e.target.value)}
                    placeholder="e.g., Methodology, Ablation Study, Limitations, Mathematical Formulation..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateViva(true)}
                  disabled={loadingViva}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {vivaList.length > 0 ? (
                    <RefreshCw className={`w-4 h-4 ${loadingViva ? 'animate-spin' : ''}`} />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {loadingViva
                    ? 'Generating Questions...'
                    : vivaList.length > 0
                      ? 'Regenerate Viva Set'
                      : 'Generate Viva Questions'}
                </button>
              </div>

              {vivaError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{vivaError}</span>
                </div>
              )}

              {vivaList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                  <GraduationCap className="w-9 h-9 text-blue-600 mx-auto" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Oral Defense &amp; Viva Simulator
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                    Generates 6 tiered examiner questions (Foundational, Intermediate, Advanced) with model answers grounded directly in the uploaded paper.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateViva(false)}
                    disabled={loadingViva}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingViva ? 'Generating...' : 'Generate 6 Viva Questions'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {['All', 'Foundational', 'Intermediate', 'Advanced'].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setDifficultyFilter(lvl)}
                          className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                            difficultyFilter === lvl
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const allOpen = filteredViva.every((q) => revealedVivaIds[q.id]);
                        const next: Record<string, boolean> = {};
                        filteredViva.forEach((q) => {
                          next[q.id] = !allOpen;
                        });
                        setRevealedVivaIds(next);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      {filteredViva.every((q) => revealedVivaIds[q.id])
                        ? 'Hide All Answers'
                        : 'Reveal All Answers'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {filteredViva.map((item, idx) => {
                      const open = Boolean(revealedVivaIds[item.id]);
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono tabular-nums font-medium text-slate-700">
                                  Q{idx + 1}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{item.difficulty}</span>
                              </div>
                              <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug">
                                {item.question}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedVivaIds((prev) => ({
                                  ...prev,
                                  [item.id]: !prev[item.id],
                                }))
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg shrink-0 cursor-pointer"
                            >
                              {open ? (
                                <>
                                  Hide Answer
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </>
                              ) : (
                                <>
                                  Reveal Answer
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>

                          {open && (
                            <div className="pt-3 border-t border-slate-100 space-y-2.5">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-slate-500">
                                  Grounded Model Answer
                                </div>
                                <p className="text-sm text-slate-800 leading-relaxed">
                                  {item.expectedAnswer}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <p className="text-xs text-slate-600">
                                  <span className="font-medium text-slate-800">Examiner tip: </span>
                                  {item.followUpTip}
                                </p>
                                <PageCitations pages={item.pages} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* TOOL 2: INTERACTIVE MCQ QUIZ */}
          {toolTab === 'mcq' && (
            <section className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600">Questions:</span>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    {[4, 6, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMcqCount(n)}
                        className={`px-2.5 py-1 text-xs font-mono tabular-nums font-medium rounded-md cursor-pointer ${
                          mcqCount === n
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {quizSubmitted && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOptions({});
                        setQuizSubmitted(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry Quiz
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleGenerateMcqs(true)}
                    disabled={loadingMcq}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    {loadingMcq
                      ? 'Building Quiz...'
                      : mcqList.length > 0
                        ? 'Generate New Quiz'
                        : 'Generate MCQ Quiz'}
                  </button>
                </div>
              </div>

              {mcqError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{mcqError}</span>
                </div>
              )}

              {mcqList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                  <HelpCircle className="w-9 h-9 text-blue-600 mx-auto" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Paper Comprehension MCQ Quiz
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                    Test your grasp of the paper&apos;s architecture, metrics, and conclusions with grounded multiple-choice questions.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateMcqs(false)}
                    disabled={loadingMcq}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingMcq ? 'Generating...' : `Start ${mcqCount}-Question Quiz`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {quizSubmitted && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500">Quiz Result</div>
                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                          {correctCount} / {mcqList.length} Correct (
                          {Math.round((correctCount / mcqList.length) * 100)}%)
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Review explanations and page citations below for every question.
                      </p>
                    </div>
                  )}

                  {mcqList.map((q, qIdx) => {
                    const picked = selectedOptions[q.id];
                    const isCorrect = picked === q.correctIndex;
                    return (
                      <div
                        key={q.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug">
                            <span className="font-mono tabular-nums text-slate-500 mr-2">
                              {qIdx + 1}.
                            </span>
                            {q.question}
                          </h3>
                          {quizSubmitted && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
                                isCorrect ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Correct
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  Incorrect
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const selected = picked === optIdx;
                            const isOptionCorrect = optIdx === q.correctIndex;

                            let optionStyle =
                              'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100';
                            if (!quizSubmitted && selected) {
                              optionStyle = 'bg-blue-50 border-blue-500 text-blue-900';
                            } else if (quizSubmitted && isOptionCorrect) {
                              optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900';
                            } else if (quizSubmitted && selected && !isOptionCorrect) {
                              optionStyle = 'bg-red-50 border-red-400 text-red-900';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={quizSubmitted}
                                onClick={() =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [q.id]: optIdx,
                                  }))
                                }
                                className={`text-left px-3.5 py-2.5 text-xs sm:text-sm border rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
                              >
                                <span>
                                  <span className="font-mono font-semibold mr-2">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  {opt}
                                </span>
                                {quizSubmitted && isOptionCorrect && (
                                  <span className="text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                                    Correct answer
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-slate-700 leading-relaxed flex-1">
                              <span className="font-semibold text-slate-900">Explanation: </span>
                              {q.explanation}
                            </p>
                            <PageCitations pages={q.pages} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!quizSubmitted && (
                    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
                      <span className="text-xs text-slate-600 font-mono tabular-nums">
                        {answeredCount} / {mcqList.length} answered
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuizSubmitted(true)}
                        disabled={answeredCount === 0}
                        className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                      >
                        Submit Quiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* TOOL 3: RESEARCH GAPS & FUTURE DIRECTIONS */}
          {toolTab === 'gaps' && (
            <section className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Literature Gaps &amp; Thesis Extension Ideas
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Uncover unaddressed edge cases, dataset constraints, and concrete future research proposals grounded in the paper.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerateGaps(true)}
                  disabled={loadingGaps}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {researchGaps ? (
                    <RefreshCw className={`w-4 h-4 ${loadingGaps ? 'animate-spin' : ''}`} />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {loadingGaps
                    ? 'Analyzing Gaps...'
                    : researchGaps
                      ? 'Re-analyze Gaps'
                      : 'Identify Research Gaps'}
                </button>
              </div>

              {gapsError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{gapsError}</span>
                </div>
              )}

              {!researchGaps ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                  <Compass className="w-9 h-9 text-blue-600 mx-auto" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Discover Research Gaps &amp; Future Directions
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                    Ideal for building a problem statement, literature review critique, or future work section for a BTech CSE project.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateGaps(false)}
                    disabled={loadingGaps}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingGaps ? 'Analyzing Paper...' : 'Analyze Gaps & Future Work'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Identified Gaps */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Identified Research Gaps ({researchGaps.gaps.length})
                    </h3>
                    <div className="space-y-3">
                      {researchGaps.gaps.map((gap, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                              {gap.title}
                            </h4>
                            <span
                              className={`text-xs font-medium whitespace-nowrap ${
                                gap.severity === 'High' ? 'text-amber-700' : 'text-slate-600'
                              }`}
                            >
                              {gap.severity} Priority
                            </span>
                          </div>
                          <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                            {gap.evidenceFromPaper}
                          </p>
                          <div className="pt-1">
                            <PageCitations pages={gap.pages} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Future Directions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Proposed Future Directions ({researchGaps.futureDirections.length})
                    </h3>
                    <div className="space-y-3">
                      {researchGaps.futureDirections.map((dir, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                        >
                          <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                            0{idx + 1}. {dir.title}
                          </h4>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">Hypothesis</div>
                            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                              {dir.hypothesis}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500">
                              Suggested Engineering Approach
                            </div>
                            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                              {dir.suggestedApproach}
                            </p>
                          </div>
                          <div className="pt-1">
                            <PageCitations pages={dir.groundedInPages} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
