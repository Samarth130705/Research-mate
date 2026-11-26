import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  MessageSquare,
  Layers,
  Sparkles,
  FileText,
} from 'lucide-react';
import {
  clearPaperChat,
  explainConcept,
  fetchOrGenerateExtraction,
  fetchOrGenerateSummary,
  sendChatQuestion,
} from '../api/client';
import type {
  ConceptExplanationResult,
  PaperAnalysisBundle,
  PaperDocument,
  PaperMetadata,
} from '../types';
import { CitationMarkdown, PageCitations } from './CitationText';
import { PdfViewer } from './PdfViewer';

interface ReaderWorkspaceProps {
  papers: PaperMetadata[];
  activePaper: PaperDocument | null;
  analysis: PaperAnalysisBundle | null;
  loadingPaper: boolean;
  initialAiTab?: 'chat' | 'summary' | 'extract';
  onSelectPaper: (paperId: string) => void;
  onAnalysisUpdate: (updated: PaperAnalysisBundle) => void;
  onOpenUpload: () => void;
}

const STARTER_QUESTIONS = [
  'What core problem does this paper address and how does it solve it?',
  'Summarize the datasets and key quantitative results reported.',
  'What limitations or failure modes do the authors acknowledge?',
  'Does this paper evaluate on ImageNet-1K?',
];

export function ReaderWorkspace({
  papers,
  activePaper,
  analysis,
  loadingPaper,
  initialAiTab = 'chat',
  onSelectPaper,
  onAnalysisUpdate,
  onOpenUpload,
}: ReaderWorkspaceProps) {
  const [aiTab, setAiTab] = useState<'chat' | 'summary' | 'extract'>(initialAiTab);
  const [mobilePane, setMobilePane] = useState<'pdf' | 'ai'>('ai');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pulseKey, setPulseKey] = useState<number>(0);

  // Chat state
  const [question, setQuestion] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Summary & Concept Explain state
  const [summaryLevel, setSummaryLevel] = useState<'executive' | 'simple' | 'detailed'>('executive');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [conceptInput, setConceptInput] = useState('');
  const [explainingConcept, setExplainingConcept] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptResult, setConceptResult] = useState<ConceptExplanationResult | null>(null);

  // Extraction state
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    setAiTab(initialAiTab);
  }, [initialAiTab]);

  useEffect(() => {
    setCurrentPage(1);
    setChatError(null);
    setSummaryError(null);
    setExtractError(null);
    setConceptResult(null);
    setConceptError(null);
  }, [activePaper?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analysis?.chatHistory.length]);

  const jumpToPage = (page: number) => {
    if (!activePaper) return;
    const clamped = Math.min(Math.max(1, page), activePaper.totalPages);
    setCurrentPage(clamped);
    setPulseKey((k) => k + 1);
    setMobilePane('pdf');
  };

  const handleSendQuestion = async (promptText?: string) => {
    if (!activePaper || !analysis) return;
    const q = (promptText ?? question).trim();
    if (!q || sendingChat) return;

    setChatError(null);
    setSendingChat(true);
    if (!promptText) setQuestion('');

    try {
      const res = await sendChatQuestion(activePaper.id, q);
      onAnalysisUpdate({
        ...analysis,
        chatHistory: res.chatHistory,
      });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to get AI response.');
      if (!promptText) setQuestion(q);
    } finally {
      setSendingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!activePaper || !analysis) return;
    await clearPaperChat(activePaper.id);
    onAnalysisUpdate({
      ...analysis,
      chatHistory: [],
    });
  };

  const handleGenerateSummary = async (
    level: 'executive' | 'simple' | 'detailed' = summaryLevel,
    force = false
  ) => {
    if (!activePaper || !analysis) return;
    setSummaryError(null);
    setLoadingSummary(true);
    try {
      const res = await fetchOrGenerateSummary(activePaper.id, level, force);
      onAnalysisUpdate({
        ...analysis,
        summaries: {
          ...analysis.summaries,
          [level]: res.summary,
        },
      });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleExplainConcept = async (term?: string) => {
    if (!activePaper) return;
    const target = (term ?? conceptInput).trim();
    if (!target) return;
    if (term) setConceptInput(term);

    setConceptError(null);
    setExplainingConcept(true);
    try {
      const res = await explainConcept(activePaper.id, target);
      setConceptResult(res.explanation);
    } catch (err) {
      setConceptError(err instanceof Error ? err.message : 'Failed to explain concept.');
    } finally {
      setExplainingConcept(false);
    }
  };

  const handleGenerateExtraction = async (force = false) => {
    if (!activePaper || !analysis) return;
    setExtractError(null);
    setLoadingExtract(true);
    try {
      const res = await fetchOrGenerateExtraction(activePaper.id, force);
      onAnalysisUpdate({
        ...analysis,
        extraction: res.extraction,
      });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract insights.');
    } finally {
      setLoadingExtract(false);
    }
  };

  const handleExportExtractionMarkdown = () => {
    if (!activePaper || !analysis?.extraction) return;
    const ext = analysis.extraction;
    const lines = [
      `# ${activePaper.title}`,
      `Authors: ${activePaper.authors}`,
      `Pages: ${activePaper.totalPages}`,
      '',
      '## Methodology',
      ext.methodology.overview,
      '',
      ...ext.methodology.steps.map(
        (s) => `- **${s.step}**: ${s.detail} (pp. ${s.pages.join(', ') || 'N/A'})`
      ),
      '',
      '## Datasets & Experimental Setup',
      ...ext.datasets.map(
        (d) => `- **${d.name}**: ${d.description} — *Usage*: ${d.usage} (pp. ${d.pages.join(', ') || 'N/A'})`
      ),
      '',
      '## Key Findings',
      ...ext.keyFindings.map(
        (f) => `- **${f.finding}**: ${f.metricOrEvidence} (pp. ${f.pages.join(', ') || 'N/A'})`
      ),
      '',
      '## Limitations',
      ...ext.limitations.map(
        (l) => `- **${l.limitation}**: ${l.impact} (pp. ${l.pages.join(', ') || 'N/A'})`
      ),
      '',
      '## Conclusions',
      ext.conclusions.summary,
      '',
      ...ext.conclusions.contributions.map(
        (c) => `- ${c.item} (pp. ${c.pages.join(', ') || 'N/A'})`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePaper.fileName.replace(/\.pdf$/i, '')}_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (papers.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <FileText className="w-10 h-10 text-slate-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">No PDF Papers Available</h2>
        <p className="text-sm text-slate-600">
          Upload a research paper PDF to open the interactive split-screen reader and AI assistant.
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

  const activeSummary = analysis?.summaries?.[summaryLevel];
  const extraction = analysis?.extraction;

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-slate-50">
      {/* Sub-header Paper Switcher & Mobile Pane Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <label htmlFor="reader-paper-select" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Active Paper:
          </label>
          <select
            id="reader-paper-select"
            value={activePaper?.id ?? ''}
            onChange={(e) => onSelectPaper(e.target.value)}
            className="text-xs sm:text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 max-w-md w-full truncate focus:outline-none focus:border-blue-500"
          >
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.totalPages}p)
              </option>
            ))}
          </select>
        </div>

        {/* Mobile/Tablet Pane Toggle */}
        <div className="flex lg:hidden items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setMobilePane('pdf')}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              mobilePane === 'pdf' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            PDF Reader
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('ai')}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              mobilePane === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            AI Studio
          </button>
        </div>
      </div>

      {/* Split Workspace */}
      {loadingPaper || !activePaper || !analysis ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          Loading paper workspace...
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Pane: PDF Reader */}
          <div
            className={`lg:col-span-6 min-h-0 h-full ${
              mobilePane === 'pdf' ? 'block' : 'hidden lg:block'
            }`}
          >
            <PdfViewer
              paper={activePaper}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              citationPulseKey={pulseKey}
            />
          </div>

          {/* Right Pane: AI Assistant Studio */}
          <div
            className={`lg:col-span-6 flex flex-col min-h-0 h-full bg-white ${
              mobilePane === 'ai' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Studio Tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAiTab('chat')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    aiTab === 'chat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI Chat
                </button>
                <button
                  type="button"
                  onClick={() => setAiTab('summary')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    aiTab === 'summary'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Summary &amp; Explain
                </button>
                <button
                  type="button"
                  onClick={() => setAiTab('extract')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    aiTab === 'extract'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Key Extraction
                </button>
              </div>

              {aiTab === 'chat' && analysis.chatHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearChat()}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* TAB 1: Grounded AI Chat */}
            {aiTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {analysis.chatHistory.length === 0 ? (
                    <div className="py-6 space-y-5">
                      <div className="space-y-1.5">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Ask questions grounded in this paper
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Answers cite exact page numbers such as <span className="font-mono text-blue-700">[p. 2]</span>. Click any citation badge to jump the PDF reader directly to that page. If information is missing from the paper, ResearchMate AI will tell you directly.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-500">Suggested questions</div>
                        <div className="grid grid-cols-1 gap-2">
                          {STARTER_QUESTIONS.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => void handleSendQuestion(q)}
                              disabled={sendingChat}
                              className="text-left px-3.5 py-2.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    analysis.chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          msg.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[92%] rounded-xl px-4 py-3 ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white text-sm'
                              : 'bg-slate-50 border border-slate-200 text-slate-800 w-full'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <p className="leading-relaxed">{msg.content}</p>
                          ) : (
                            <div className="space-y-2.5">
                              {msg.notFoundInPaper && (
                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Not found in uploaded paper</span>
                                </div>
                              )}
                              <CitationMarkdown
                                content={msg.content}
                                onJumpToPage={jumpToPage}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {sendingChat && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                      Reading paper pages and verifying citations...
                    </div>
                  )}

                  {chatError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {chatError}
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSendQuestion();
                  }}
                  className="p-3 border-t border-slate-200 bg-white shrink-0"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask about methodology, metrics, equations, or datasets..."
                      disabled={sendingChat}
                      className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={sendingChat || !question.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-4 h-4" />
                      Ask
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 2: Summary & Plain-Language Concept Explainer */}
            {aiTab === 'summary' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
                {/* Summary Section */}
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Paper Summary</h3>
                      <p className="text-xs text-slate-500">
                        Choose an explanation depth grounded in page citations.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                        {(
                          [
                            ['executive', 'Executive'],
                            ['simple', 'Simple Language'],
                            ['detailed', 'Detailed'],
                          ] as const
                        ).map(([lvl, label]) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setSummaryLevel(lvl)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                              summaryLevel === lvl
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {activeSummary && (
                        <button
                          type="button"
                          onClick={() => void handleGenerateSummary(summaryLevel, true)}
                          disabled={loadingSummary}
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                          title="Regenerate summary"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {summaryError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {summaryError}
                    </div>
                  )}

                  {!activeSummary ? (
                    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/70 text-center space-y-3">
                      <p className="text-sm font-medium text-slate-900">
                        Generate a {summaryLevel === 'simple' ? 'plain-language' : summaryLevel} summary
                      </p>
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        Produces a structured overview, key takeaways, and section breakdown with clickable page references.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleGenerateSummary(summaryLevel, false)}
                        disabled={loadingSummary}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {loadingSummary ? 'Summarizing Paper...' : 'Generate Summary'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="text-xs font-semibold text-slate-500">Overview</div>
                        <CitationMarkdown
                          content={activeSummary.overview}
                          onJumpToPage={jumpToPage}
                        />
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold text-slate-500">Key Takeaways</h4>
                        <ul className="space-y-2">
                          {activeSummary.keyTakeaways.map((item, idx) => (
                            <li
                              key={idx}
                              className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 flex flex-col gap-1.5"
                            >
                              <span className="leading-relaxed">{item.point}</span>
                              <div>
                                <PageCitations pages={item.pages} onJumpToPage={jumpToPage} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2.5">
                        <h4 className="text-xs font-semibold text-slate-500">
                          Section-by-Section Breakdown
                        </h4>
                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                          {activeSummary.sectionBreakdown.map((sec, idx) => (
                            <div key={idx} className="p-4 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {sec.section}
                                </span>
                                <PageCitations pages={sec.pages} onJumpToPage={jumpToPage} />
                              </div>
                              <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                                {sec.summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Divider */}
                <hr className="border-slate-200" />

                {/* Simple Concept Explainer */}
                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      Explain Complex Concept Simply
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter any technical term, algorithm, or metric from the paper to understand it in plain language.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleExplainConcept();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={conceptInput}
                      onChange={(e) => setConceptInput(e.target.value)}
                      placeholder="e.g., Reciprocal Rank Fusion, NF4 quantization, Cross-Encoder..."
                      className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={explainingConcept || !conceptInput.trim()}
                      className="px-4 py-2 text-xs sm:text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      {explainingConcept ? 'Explaining...' : 'Explain Simply'}
                    </button>
                  </form>

                  {conceptError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {conceptError}
                    </div>
                  )}

                  {conceptResult && (
                    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {conceptResult.concept}
                        </h4>
                        <PageCitations pages={conceptResult.pages} onJumpToPage={jumpToPage} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-500">Plain-Language Explanation</div>
                        <p className="text-sm text-slate-800 leading-relaxed">
                          {conceptResult.simpleExplanation}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-500">Intuitive Analogy</div>
                        <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                          {conceptResult.analogy}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-500">How This Paper Uses It</div>
                        <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                          {conceptResult.paperContext}
                        </p>
                      </div>

                      {conceptResult.relatedConcepts.length > 0 && (
                        <div className="pt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500 mr-1">Explore next:</span>
                          {conceptResult.relatedConcepts.map((rel) => (
                            <button
                              key={rel}
                              type="button"
                              onClick={() => void handleExplainConcept(rel)}
                              className="px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                              {rel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 3: Structured Extraction */}
            {aiTab === 'extract' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Structured Paper Extraction
                    </h3>
                    <p className="text-xs text-slate-500">
                      Methodology, datasets, key findings, limitations, and conclusions with page citations.
                    </p>
                  </div>

                  {extraction && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportExtractionMarkdown}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export .md
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerateExtraction(true)}
                        disabled={loadingExtract}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingExtract ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>
                  )}
                </div>

                {extractError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {extractError}
                  </div>
                )}

                {!extraction ? (
                  <div className="border border-slate-200 rounded-xl p-8 bg-slate-50/70 text-center space-y-3">
                    <Layers className="w-8 h-8 text-blue-600 mx-auto" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Extract Core Research Components
                    </h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                      Automatically map out the paper&apos;s methodology pipeline, datasets, quantitative findings, acknowledged limitations, and conclusions.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGenerateExtraction(false)}
                      disabled={loadingExtract}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {loadingExtract ? 'Extracting Insights...' : 'Run Structured Extraction'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Methodology */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">01. Methodology</h4>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {extraction.methodology.overview}
                      </p>
                      <div className="divide-y divide-slate-100 pt-1">
                        {extraction.methodology.steps.map((s, idx) => (
                          <div key={idx} className="py-2.5 flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">{s.step}</span>
                              <PageCitations pages={s.pages} onJumpToPage={jumpToPage} />
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{s.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Datasets */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        02. Datasets &amp; Experimental Setup
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {extraction.datasets.map((d, idx) => (
                          <div key={idx} className="py-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">{d.name}</span>
                              <PageCitations pages={d.pages} onJumpToPage={jumpToPage} />
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed">{d.description}</p>
                            <p className="text-xs text-slate-500">Usage: {d.usage}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Findings */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        03. Key Findings &amp; Metrics
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {extraction.keyFindings.map((f, idx) => (
                          <div key={idx} className="py-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {f.finding}
                              </span>
                              <PageCitations pages={f.pages} onJumpToPage={jumpToPage} />
                            </div>
                            <p className="text-xs font-mono text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
                              {f.metricOrEvidence}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Limitations */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">04. Limitations</h4>
                      <div className="divide-y divide-slate-100">
                        {extraction.limitations.map((l, idx) => (
                          <div key={idx} className="py-2.5 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {l.limitation}
                              </span>
                              <PageCitations pages={l.pages} onJumpToPage={jumpToPage} />
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{l.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conclusions */}
                    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500">05. Conclusions</h4>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {extraction.conclusions.summary}
                      </p>
                      <ul className="space-y-2 pt-1">
                        {extraction.conclusions.contributions.map((c, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-700 flex items-start justify-between gap-3 py-1.5 border-t border-slate-100"
                          >
                            <span className="leading-relaxed">{c.item}</span>
                            <PageCitations pages={c.pages} onJumpToPage={jumpToPage} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
