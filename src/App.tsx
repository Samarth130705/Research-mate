import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Library,
  BookOpen,
  GitCompare,
  GraduationCap,
  FilePlus2,
  Menu,
  X,
} from 'lucide-react';
import {
  deletePaper,
  fetchPaperDetail,
  fetchPapers,
  fetchSavedComparisons,
} from './api/client';
import { CompareView } from './components/CompareView';
import { DashboardView } from './components/DashboardView';
import { LibraryView } from './components/LibraryView';
import { ReaderWorkspace } from './components/ReaderWorkspace';
import { ResearchToolsView } from './components/ResearchToolsView';
import { UploadModal } from './components/UploadModal';
import type {
  PaperAnalysisBundle,
  PaperComparisonResult,
  PaperDocument,
  PaperMetadata,
  WorkspaceTab,
} from './types';

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Paper Library', icon: Library },
  { id: 'reader', label: 'Reader & AI', icon: BookOpen },
  { id: 'compare', label: 'Compare Papers', icon: GitCompare },
  { id: 'tools', label: 'Research Tools', icon: GraduationCap },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [readerAiTab, setReaderAiTab] = useState<'chat' | 'summary' | 'extract'>('chat');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [papers, setPapers] = useState<PaperMetadata[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [activePaperDoc, setActivePaperDoc] = useState<PaperDocument | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<PaperAnalysisBundle | null>(null);
  const [loadingPaperDetail, setLoadingPaperDetail] = useState(false);

  const [savedComparisons, setSavedComparisons] = useState<PaperComparisonResult[]>([]);
  const [comparePaperAId, setComparePaperAId] = useState<string | null>(null);

  const loadPaperById = useCallback(async (id: string) => {
    setLoadingPaperDetail(true);
    setActivePaperId(id);
    try {
      const { paper, analysis } = await fetchPaperDetail(id);
      setActivePaperDoc(paper);
      setActiveAnalysis(analysis);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load paper.');
    } finally {
      setLoadingPaperDetail(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [paperList, comparisonList] = await Promise.all([
          fetchPapers(),
          fetchSavedComparisons(),
        ]);
        if (!mounted) return;
        setPapers(paperList);
        setSavedComparisons(comparisonList);
        if (paperList.length > 0) {
          await loadPaperById(paperList[0].id);
        }
      } catch (err) {
        if (mounted) {
          setGlobalError(
            err instanceof Error ? err.message : 'Unable to connect to ResearchMate AI server.'
          );
        }
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, [loadPaperById]);

  const handleOpenPaper = async (
    paperId: string,
    aiTab: 'chat' | 'summary' | 'extract' = 'chat'
  ) => {
    setReaderAiTab(aiTab);
    setActiveTab('reader');
    setMobileNavOpen(false);
    if (activePaperDoc?.id !== paperId) {
      await loadPaperById(paperId);
    }
  };

  const handleOpenToolsForPaper = async (paperId: string) => {
    setActiveTab('tools');
    setMobileNavOpen(false);
    if (activePaperDoc?.id !== paperId) {
      await loadPaperById(paperId);
    }
  };

  const handleStartCompareWith = (paperId: string) => {
    setComparePaperAId(paperId);
    setActiveTab('compare');
    setMobileNavOpen(false);
  };

  const handleUploaded = (paper: PaperDocument, analysis: PaperAnalysisBundle) => {
    const { pages: _pages, ...meta } = paper;
    setPapers((prev) => [meta, ...prev.filter((p) => p.id !== paper.id)]);
    setActivePaperId(paper.id);
    setActivePaperDoc(paper);
    setActiveAnalysis(analysis);
    setReaderAiTab('chat');
    setActiveTab('reader');
  };

  const handleDeletePaper = async (paperId: string) => {
    await deletePaper(paperId);
    const nextPapers = papers.filter((p) => p.id !== paperId);
    setPapers(nextPapers);
    setSavedComparisons((prev) =>
      prev.filter((c) => c.paperAId !== paperId && c.paperBId !== paperId)
    );
    if (activePaperId === paperId) {
      if (nextPapers.length > 0) {
        await loadPaperById(nextPapers[0].id);
      } else {
        setActivePaperId(null);
        setActivePaperDoc(null);
        setActiveAnalysis(null);
      }
    }
  };

  const currentTabLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-[57px] px-5 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap cursor-pointer"
          >
            ResearchMate AI
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="text-xs font-medium text-slate-500">Library Summary</div>
          <div className="text-xs text-slate-700 font-mono tabular-nums">
            {papers.length} {papers.length === 1 ? 'paper' : 'papers'} indexed
          </div>
          {activePaperDoc && (
            <div className="text-[11px] text-slate-500 truncate" title={activePaperDoc.title}>
              Active: {activePaperDoc.title}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-[57px] px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold tracking-tight text-slate-900">
                ResearchMate AI
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0 min-h-screen">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action button on right */}
        <header className="h-[57px] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-slate-900 md:hidden whitespace-nowrap">
                ResearchMate AI
              </span>
              <span className="text-slate-400 md:hidden">/</span>
              <span className="hidden md:inline text-slate-500 whitespace-nowrap">Workspace</span>
              <span className="hidden md:inline text-slate-300">/</span>
              <span className="font-medium text-slate-900 truncate">{currentTabLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Upload Paper
          </button>
        </header>

        {globalError && (
          <div className="mx-4 sm:mx-8 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
            <span>{globalError}</span>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-red-800 font-medium underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {initialLoading ? (
            <div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
              <div className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  papers={papers}
                  activePaperId={activePaperId}
                  comparisonsCount={savedComparisons.length}
                  onOpenUpload={() => setUploadOpen(true)}
                  onOpenPaper={handleOpenPaper}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'library' && (
                <LibraryView
                  papers={papers}
                  activePaperId={activePaperId}
                  onOpenUpload={() => setUploadOpen(true)}
                  onOpenPaper={handleOpenPaper}
                  onOpenToolsForPaper={handleOpenToolsForPaper}
                  onStartCompareWith={handleStartCompareWith}
                  onDeletePaper={handleDeletePaper}
                />
              )}

              {activeTab === 'reader' && (
                <ReaderWorkspace
                  papers={papers}
                  activePaper={activePaperDoc}
                  analysis={activeAnalysis}
                  loadingPaper={loadingPaperDetail}
                  initialAiTab={readerAiTab}
                  onSelectPaper={(id) => void loadPaperById(id)}
                  onAnalysisUpdate={setActiveAnalysis}
                  onOpenUpload={() => setUploadOpen(true)}
                />
              )}

              {activeTab === 'compare' && (
                <CompareView
                  papers={papers}
                  savedComparisons={savedComparisons}
                  initialPaperAId={comparePaperAId}
                  onComparisonSaved={(comp) =>
                    setSavedComparisons((prev) => [
                      comp,
                      ...prev.filter(
                        (c) =>
                          !(c.paperAId === comp.paperAId && c.paperBId === comp.paperBId)
                      ),
                    ])
                  }
                  onOpenPaperPage={(paperId) => void handleOpenPaper(paperId, 'chat')}
                  onOpenUpload={() => setUploadOpen(true)}
                />
              )}

              {activeTab === 'tools' && (
                <ResearchToolsView
                  papers={papers}
                  activePaperId={activePaperId}
                  analysis={activeAnalysis}
                  loadingAnalysis={loadingPaperDetail}
                  onSelectPaper={(id) => void loadPaperById(id)}
                  onAnalysisUpdate={setActiveAnalysis}
                  onOpenPaperInReader={(id) => void handleOpenPaper(id, 'chat')}
                  onOpenUpload={() => setUploadOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />
    </div>
  );
}
