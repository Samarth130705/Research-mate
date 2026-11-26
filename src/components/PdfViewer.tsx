import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  Search,
  AlertCircle,
} from 'lucide-react';
import type { PaperDocument } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  paper: PaperDocument;
  currentPage: number;
  onPageChange: (page: number) => void;
  citationPulseKey?: number;
}

export function PdfViewer({
  paper,
  currentPage,
  onPageChange,
  citationPulseKey = 0,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [viewMode, setViewMode] = useState<'pdf' | 'text'>('pdf');
  const [zoom, setZoom] = useState<number>(1.15);
  const [pageInput, setPageInput] = useState<string>(String(currentPage));
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pulseActive, setPulseActive] = useState<boolean>(false);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (citationPulseKey > 0) {
      setPulseActive(true);
      const timer = window.setTimeout(() => setPulseActive(false), 1100);
      return () => window.clearTimeout(timer);
    }
  }, [citationPulseKey]);

  // Load PDF document when paper.id changes
  useEffect(() => {
    let cancelled = false;
    setLoadingPdf(true);
    setPdfError(null);

    const loadingTask = pdfjsLib.getDocument({
      url: `/api/papers/${encodeURIComponent(paper.id)}/pdf`,
    });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.cleanup();
          return;
        }
        pdfDocRef.current = doc;
        setLoadingPdf(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Unable to load PDF preview.');
        setLoadingPdf(false);
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      void loadingTask.destroy();
      if (pdfDocRef.current) {
        void pdfDocRef.current.cleanup();
        pdfDocRef.current = null;
      }
    };
  }, [paper.id]);

  // Render active page onto canvas
  useEffect(() => {
    if (viewMode !== 'pdf' || loadingPdf || pdfError || !pdfDocRef.current) return;

    let cancelled = false;
    const safePage = Math.min(Math.max(1, currentPage), paper.totalPages);

    const renderPage = async () => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancel race
        }
      }

      setRenderingPage(true);
      try {
        const page = await pdfDocRef.current.getPage(safePage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const task = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) {
          setRenderingPage(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
        if (name !== 'RenderingCancelledException') {
          setRenderingPage(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [paper.id, paper.totalPages, currentPage, zoom, viewMode, loadingPdf, pdfError]);

  const commitPageInput = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const clamped = Math.min(Math.max(1, Math.round(parsed)), paper.totalPages);
    onPageChange(clamped);
    setPageInput(String(clamped));
  };

  const activePageText =
    paper.pages.find((p) => p.pageNumber === currentPage)?.text ??
    'No text extracted for this page.';

  const matchingPages = searchQuery.trim()
    ? paper.pages.filter((p) =>
        p.text.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-slate-100/80 border-r border-slate-200">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200 shrink-0">
        {/* Left: Mode switcher & page controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'pdf'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PDF View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('text')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'text'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Page Text
            </button>
          </div>

          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 text-xs text-slate-600 font-mono tabular-nums">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Current page number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPageInput();
                }}
                className="w-10 text-center py-0.5 border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <span>/ {paper.totalPages}</span>
            </div>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(paper.totalPages, currentPage + 1))}
              disabled={currentPage >= paper.totalPages}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Zoom & Download */}
        <div className="flex items-center gap-1.5">
          {viewMode === 'pdf' && (
            <div className="flex items-center gap-0.5 border border-slate-200 rounded-md px-1 py-0.5 bg-white">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1.15)}
                className="px-1.5 text-[11px] font-mono tabular-nums text-slate-700 hover:text-slate-900 cursor-pointer"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <a
            href={`/api/papers/${encodeURIComponent(paper.id)}/pdf`}
            download={paper.fileName}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
            title="Download original PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </a>
        </div>
      </div>

      {/* In-paper keyword search strip when in Page Text mode */}
      {viewMode === 'text' && (
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find keyword across all pages..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          {searchQuery.trim() && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600">
              <span className="tabular-nums">
                {matchingPages.length} {matchingPages.length === 1 ? 'page' : 'pages'}:
              </span>
              {matchingPages.slice(0, 8).map((p) => (
                <button
                  key={p.pageNumber}
                  type="button"
                  onClick={() => onPageChange(p.pageNumber)}
                  className={`px-1.5 py-0.5 rounded font-mono tabular-nums text-[11px] border cursor-pointer ${
                    p.pageNumber === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  p.{p.pageNumber}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content viewport */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center items-start">
        {viewMode === 'pdf' ? (
          pdfError ? (
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 mt-8">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-900">PDF Canvas Unavailable</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{pdfError}</p>
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className="px-3.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                Switch to Page Text View
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center">
              {loadingPdf && (
                <div className="w-[460px] max-w-full h-[640px] bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500">
                  <FileText className="w-7 h-7 text-slate-400" />
                  <span className="text-xs font-medium">Loading PDF document...</span>
                </div>
              )}
              <div
                className={`bg-white border rounded-sm shadow-sm transition-shadow duration-300 ${
                  pulseActive
                    ? 'border-blue-500 ring-4 ring-blue-500/20'
                    : 'border-slate-300/90'
                } ${loadingPdf ? 'hidden' : 'block'}`}
              >
                <canvas ref={canvasRef} className="block max-w-full h-auto" />
              </div>
              {renderingPage && !loadingPdf && (
                <span className="mt-2 text-[11px] font-mono text-slate-500">
                  Rendering page {currentPage}...
                </span>
              )}
            </div>
          )
        ) : (
          <div
            className={`w-full max-w-2xl bg-white border rounded-xl p-6 sm:p-8 shadow-xs transition-shadow ${
              pulseActive ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Extracted Page {currentPage} of {paper.totalPages}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-[260px]">
                {paper.fileName}
              </span>
            </div>
            <div className="font-serif text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">
              {activePageText}
            </div>
          </div>
        )}
      </div>

      {/* Bottom quick page strip */}
      <div className="px-3 py-1.5 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <span className="truncate max-w-[65%]">{paper.title}</span>
        <span className="font-mono tabular-nums">
          Page {currentPage} / {paper.totalPages}
        </span>
      </div>
    </div>
  );
}
