import React, { useRef, useState } from 'react';
import { Upload, FileUp, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { uploadPdfPaper } from '../api/client';
import type { PaperAnalysisBundle, PaperDocument } from '../types';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (paper: PaperDocument, analysis: PaperAnalysisBundle) => void;
}

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setSuccessMsg(null);

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a valid PDF (.pdf) research paper.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25 MB upload limit.');
      return;
    }

    setSelectedFileName(file.name);
    setUploading(true);
    try {
      const result = await uploadPdfPaper(file);
      setSuccessMsg(`Indexed ${result.paper.totalPages} pages successfully.`);
      onUploaded(result.paper, result.analysis);
      window.setTimeout(() => {
        setUploading(false);
        setSelectedFileName(null);
        setSuccessMsg(null);
        onClose();
      }, 450);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Failed to upload PDF.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="upload-modal-title" className="text-base font-semibold text-slate-900">
              Upload Research Paper
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Text-based PDF documents up to 25 MB are indexed page-by-page for citations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !uploading && onClose()}
            disabled={uploading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close upload dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (uploading) return;
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragging
                ? 'border-blue-500 bg-blue-50/70'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
            } ${uploading ? 'pointer-events-none opacity-80' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />

            <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 text-blue-600">
              {uploading ? <FileUp className="w-5 h-5 animate-bounce" /> : <Upload className="w-5 h-5" />}
            </div>

            {uploading ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  Extracting pages and indexing text...
                </p>
                <p className="text-xs text-slate-500 truncate max-w-xs mx-auto">
                  {selectedFileName}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  Drop a PDF paper here, or <span className="text-blue-600">browse files</span>
                </p>
                <p className="text-xs text-slate-500">
                  Supports IEEE, arXiv, Springer, ACM, and thesis PDFs
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
