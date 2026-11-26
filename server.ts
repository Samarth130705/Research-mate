import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  chatWithPaper,
  compareTwoPapers,
  explainConceptInPaper,
  extractPaperMetadataWithAi,
  extractStructuredInsights,
  generateMcqQuiz,
  generatePaperSummary,
  generateVivaQuestions,
  identifyResearchGaps,
} from './server/geminiService.js';
import { extractPdfPages, isValidPdfBuffer } from './server/pdfUtils.js';
import { seedSamplePapersIfEmpty } from './server/samplePapers.js';
import {
  deletePaperById,
  ensureDataDirs,
  getPaperAnalysis,
  getPaperById,
  getSafePdfPath,
  getSavedComparisons,
  listPaperMetadata,
  saveComparisonResult,
  savePaperDocument,
  updatePaperAnalysis,
} from './server/storage.js';
import type { ChatMessage, PaperDocument } from './src/types.js';

const PORT = Number(process.env.PORT) || 3000;
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const isPdfMime =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdfMime) {
      cb(new Error('Only PDF files (.pdf) are supported.'));
      return;
    }
    cb(null, true);
  },
});

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : 'Unexpected server error.';
  let msg = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      msg = parsed.error.message;
    }
  } catch {
    // Keep raw message if not JSON
  }

  if (msg.includes('GEMINI_API_KEY')) {
    return { status: 400, message: msg };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or unauthorized. Please check Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message: 'The AI model is temporarily experiencing high demand. Please try again in a few seconds.',
    };
  }
  return { status: 500, message: msg };
}

async function startServer(): Promise<void> {
  ensureDataDirs();
  await seedSamplePapersIfEmpty();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // List all uploaded papers
  app.get('/api/papers', (_req: Request, res: Response) => {
    const papers = listPaperMetadata();
    res.json({ papers });
  });

  // Get single paper + persisted analysis bundle
  app.get('/api/papers/:id', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const paper = getPaperById(id);
    if (!paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }
    const analysis = getPaperAnalysis(id);
    res.json({ paper, analysis });
  });

  // Stream raw PDF file safely
  app.get('/api/papers/:id/pdf', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }
      const pdfPath = getSafePdfPath(id);
      if (!fs.existsSync(pdfPath)) {
        res.status(404).json({ error: 'PDF binary not found on server.' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(paper.fileName)}"`
      );
      fs.createReadStream(pdfPath).pipe(res);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid paper ID.' });
    }
  });

  // Upload and index a PDF paper
  app.post('/api/papers/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Please select a PDF file to upload.' });
        return;
      }

      if (!isValidPdfBuffer(req.file.buffer)) {
        res.status(400).json({ error: 'The uploaded file is not a valid PDF document.' });
        return;
      }

      const extracted = await extractPdfPages(req.file.buffer, req.file.originalname);
      if (extracted.totalPages === 0) {
        res.status(400).json({ error: 'Could not read any pages from this PDF.' });
        return;
      }

      const hasExtractableText = extracted.pages.some((p) => p.text.trim().length > 20);
      if (!hasExtractableText) {
        res.status(400).json({
          error:
            'No selectable text was found in this PDF. Please upload a text-based PDF (scanned image-only PDFs without OCR are not supported).',
        });
        return;
      }

      const openingText = extracted.pages
        .slice(0, 2)
        .map((p) => `[Page ${p.pageNumber}]\n${p.text}`)
        .join('\n\n');

      const meta = await extractPaperMetadataWithAi(
        {
          title: extracted.fallbackTitle,
          authors: extracted.fallbackAuthors,
          abstract: extracted.fallbackAbstract,
        },
        openingText
      );

      const paper: PaperDocument = {
        id: `paper-${crypto.randomUUID().slice(0, 12)}`,
        title: meta.title || extracted.fallbackTitle,
        authors: meta.authors || extracted.fallbackAuthors,
        domain: meta.domain || 'Academic Research',
        year: meta.year || 'Uploaded PDF',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        totalPages: extracted.totalPages,
        wordCount: extracted.wordCount,
        abstractSnippet: meta.abstractSnippet || extracted.fallbackAbstract,
        uploadedAt: new Date().toISOString(),
        isSample: false,
        pages: extracted.pages,
      };

      savePaperDocument(paper, req.file.buffer);
      const analysis = getPaperAnalysis(paper.id);
      res.status(201).json({ paper, analysis });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to parse and index the uploaded PDF.',
      });
    }
  });

  // Delete a paper
  app.delete('/api/papers/:id', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const deleted = deletePaperById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }
    res.json({ deleted: true, id });
  });

  // Grounded Q&A Chat
  app.post('/api/papers/:id/chat', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (!question) {
        res.status(400).json({ error: 'Please enter a question about the paper.' });
        return;
      }

      const currentBundle = getPaperAnalysis(id);
      const result = await chatWithPaper(paper, currentBundle.chatHistory, question);

      const userMessage: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 10)}`,
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: `msg-${crypto.randomUUID().slice(0, 10)}`,
        role: 'assistant',
        content: result.answer,
        timestamp: new Date().toISOString(),
        notFoundInPaper: result.notFoundInPaper,
      };

      const updated = updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        chatHistory: [...bundle.chatHistory, userMessage, assistantMessage],
      }));

      res.json({
        userMessage,
        assistantMessage,
        chatHistory: updated.chatHistory,
      });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/papers/:id/chat', (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const paper = getPaperById(id);
    if (!paper) {
      res.status(404).json({ error: 'Paper not found.' });
      return;
    }
    updatePaperAnalysis(id, (bundle) => ({ ...bundle, chatHistory: [] }));
    res.json({ cleared: true });
  });

  // Generate or fetch cached summary
  app.post('/api/papers/:id/summary', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const rawLevel = req.body?.level;
      const level: 'executive' | 'simple' | 'detailed' =
        rawLevel === 'simple' || rawLevel === 'detailed' ? rawLevel : 'executive';
      const force = Boolean(req.body?.force);

      const existing = getPaperAnalysis(id).summaries[level];
      if (existing && !force) {
        res.json({ summary: existing, cached: true });
        return;
      }

      const summary = await generatePaperSummary(paper, level);
      updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        summaries: {
          ...bundle.summaries,
          [level]: summary,
        },
      }));

      res.json({ summary, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Explain a complex concept in simple language
  app.post('/api/papers/:id/explain', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const concept = typeof req.body?.concept === 'string' ? req.body.concept.trim() : '';
      if (!concept) {
        res.status(400).json({ error: 'Please specify a concept or term to explain.' });
        return;
      }

      const explanation = await explainConceptInPaper(paper, concept);
      res.json({ explanation });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Extract methodology, datasets, findings, limitations, conclusions
  app.post('/api/papers/:id/extract', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const force = Boolean(req.body?.force);
      const existing = getPaperAnalysis(id).extraction;
      if (existing && !force) {
        res.json({ extraction: existing, cached: true });
        return;
      }

      const extraction = await extractStructuredInsights(paper);
      updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        extraction,
      }));

      res.json({ extraction, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Generate Viva Questions
  app.post('/api/papers/:id/viva', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const focusTopic = typeof req.body?.focusTopic === 'string' ? req.body.focusTopic.trim() : '';
      const force = Boolean(req.body?.force);
      const existing = getPaperAnalysis(id).vivaQuestions;
      if (existing && !force && !focusTopic) {
        res.json({ vivaQuestions: existing, cached: true });
        return;
      }

      const vivaQuestions = await generateVivaQuestions(paper, focusTopic);
      updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        vivaQuestions,
      }));

      res.json({ vivaQuestions, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Generate MCQs
  app.post('/api/papers/:id/mcqs', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const countRaw = Number(req.body?.count);
      const count = Number.isFinite(countRaw) ? Math.min(10, Math.max(3, Math.round(countRaw))) : 6;
      const force = Boolean(req.body?.force);

      const existing = getPaperAnalysis(id).mcqs;
      if (existing && !force && existing.length === count) {
        res.json({ mcqs: existing, cached: true });
        return;
      }

      const mcqs = await generateMcqQuiz(paper, count);
      updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        mcqs,
      }));

      res.json({ mcqs, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Identify Research Gaps & Future Directions
  app.post('/api/papers/:id/gaps', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? '');
      const paper = getPaperById(id);
      if (!paper) {
        res.status(404).json({ error: 'Paper not found.' });
        return;
      }

      const force = Boolean(req.body?.force);
      const existing = getPaperAnalysis(id).researchGaps;
      if (existing && !force) {
        res.json({ researchGaps: existing, cached: true });
        return;
      }

      const researchGaps = await identifyResearchGaps(paper);
      updatePaperAnalysis(id, (bundle) => ({
        ...bundle,
        researchGaps,
      }));

      res.json({ researchGaps, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Saved comparisons
  app.get('/api/comparisons', (_req: Request, res: Response) => {
    res.json({ comparisons: getSavedComparisons() });
  });

  // Compare two research papers
  app.post('/api/compare', async (req: Request, res: Response) => {
    try {
      const paperAId = typeof req.body?.paperAId === 'string' ? req.body.paperAId.trim() : '';
      const paperBId = typeof req.body?.paperBId === 'string' ? req.body.paperBId.trim() : '';
      const force = Boolean(req.body?.force);

      if (!paperAId || !paperBId) {
        res.status(400).json({ error: 'Please select two papers to compare.' });
        return;
      }
      if (paperAId === paperBId) {
        res.status(400).json({ error: 'Please select two different papers for comparison.' });
        return;
      }

      const paperA = getPaperById(paperAId);
      const paperB = getPaperById(paperBId);
      if (!paperA || !paperB) {
        res.status(404).json({ error: 'One or both selected papers were not found.' });
        return;
      }

      if (!force) {
        const cached = getSavedComparisons().find(
          (c) => c.paperAId === paperAId && c.paperBId === paperBId
        );
        if (cached) {
          res.json({ comparison: cached, cached: true });
          return;
        }
      }

      const comparison = await compareTwoPapers(paperA, paperB);
      saveComparisonResult(comparison);
      res.json({ comparison, cached: false });
    } catch (err) {
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Multer & upload error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(400).json({ error: err.message || 'Invalid request.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ResearchMate AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ResearchMate AI server:', err);
  process.exit(1);
});
