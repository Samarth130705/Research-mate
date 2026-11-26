import fs from 'fs';
import path from 'path';
import type {
  PaperAnalysisBundle,
  PaperComparisonResult,
  PaperDocument,
  PaperMetadata,
} from '../src/types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const PAPERS_FILE = path.resolve(DATA_DIR, 'papers.json');
const ANALYSES_FILE = path.resolve(DATA_DIR, 'analyses.json');
const COMPARISONS_FILE = path.resolve(DATA_DIR, 'comparisons.json');

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function getSafePdfPath(paperId: string): string {
  // Enforce strict UUID / safe-character confinement
  if (!/^[a-zA-Z0-9_-]+$/.test(paperId)) {
    throw new Error('Invalid paper identifier');
  }
  const resolved = path.resolve(UPLOADS_DIR, `${paperId}.pdf`);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return resolved;
}

export function hasPapersStore(): boolean {
  return fs.existsSync(PAPERS_FILE);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDirs();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function listAllPaperDocuments(): PaperDocument[] {
  return readJsonFile<PaperDocument[]>(PAPERS_FILE, []);
}

export function listPaperMetadata(): PaperMetadata[] {
  return listAllPaperDocuments().map(({ pages: _pages, ...meta }) => meta);
}

export function getPaperById(id: string): PaperDocument | undefined {
  return listAllPaperDocuments().find((p) => p.id === id);
}

export function savePaperDocument(paper: PaperDocument, pdfBuffer: Buffer): void {
  ensureDataDirs();
  const pdfPath = getSafePdfPath(paper.id);
  fs.writeFileSync(pdfPath, pdfBuffer);
  const existing = listAllPaperDocuments().filter((p) => p.id !== paper.id);
  existing.unshift(paper);
  writeJsonFile(PAPERS_FILE, existing);
}

export function deletePaperById(id: string): boolean {
  const existing = listAllPaperDocuments();
  const next = existing.filter((p) => p.id !== id);
  if (next.length === existing.length) return false;

  writeJsonFile(PAPERS_FILE, next);

  try {
    const pdfPath = getSafePdfPath(id);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }
  } catch {
    // Ignore missing file on delete
  }

  const analyses = readJsonFile<Record<string, PaperAnalysisBundle>>(ANALYSES_FILE, {});
  if (analyses[id]) {
    delete analyses[id];
    writeJsonFile(ANALYSES_FILE, analyses);
  }

  return true;
}

export function getPaperAnalysis(paperId: string): PaperAnalysisBundle {
  const all = readJsonFile<Record<string, PaperAnalysisBundle>>(ANALYSES_FILE, {});
  return (
    all[paperId] ?? {
      paperId,
      summaries: {},
      chatHistory: [],
    }
  );
}

export function updatePaperAnalysis(
  paperId: string,
  updater: (current: PaperAnalysisBundle) => PaperAnalysisBundle
): PaperAnalysisBundle {
  const all = readJsonFile<Record<string, PaperAnalysisBundle>>(ANALYSES_FILE, {});
  const current: PaperAnalysisBundle = all[paperId] ?? {
    paperId,
    summaries: {},
    chatHistory: [],
  };
  const updated = updater(current);
  all[paperId] = updated;
  writeJsonFile(ANALYSES_FILE, all);
  return updated;
}

export function getSavedComparisons(): PaperComparisonResult[] {
  return readJsonFile<PaperComparisonResult[]>(COMPARISONS_FILE, []);
}

export function saveComparisonResult(result: PaperComparisonResult): void {
  const existing = getSavedComparisons().filter(
    (c) =>
      !(
        (c.paperAId === result.paperAId && c.paperBId === result.paperBId) ||
        (c.paperAId === result.paperBId && c.paperBId === result.paperAId)
      )
  );
  existing.unshift(result);
  writeJsonFile(COMPARISONS_FILE, existing.slice(0, 12));
}
