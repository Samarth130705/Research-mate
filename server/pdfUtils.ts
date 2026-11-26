import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PaperPage } from '../src/types.js';

export interface ExtractedPdfData {
  pages: PaperPage[];
  totalPages: number;
  wordCount: number;
  fallbackTitle: string;
  fallbackAuthors: string;
  fallbackAbstract: string;
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  const header = buffer.subarray(0, 5).toString('ascii');
  return header === '%PDF-';
}

export async function extractPdfPages(buffer: Buffer, originalFileName: string): Promise<ExtractedPdfData> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    verbosity: 0,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pages: PaperPage[] = [];
  let totalWords = 0;

  let metadataTitle = '';
  let metadataAuthor = '';

  try {
    const meta = await pdfDoc.getMetadata();
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    if (typeof info.Title === 'string' && info.Title.trim().length > 3) {
      metadataTitle = info.Title.trim();
    }
    if (typeof info.Author === 'string' && info.Author.trim().length > 1) {
      metadataAuthor = info.Author.trim();
    }
  } catch {
    // Metadata is optional; ignore if absent
  }

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items by vertical baseline to preserve line breaks cleanly
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      const transform = Array.isArray(item.transform) ? item.transform : [];
      const y = typeof transform[5] === 'number' ? Math.round(transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim().length > 0) {
          lines.push(currentLine.trim());
        }
        currentLine = text;
      } else {
        currentLine += (currentLine && !currentLine.endsWith(' ') && !text.startsWith(' ') ? ' ' : '') + text;
      }
      if (y !== null) {
        lastY = y;
      }
    }

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
    }

    const pageText = lines.join('\n').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const words = pageText ? pageText.split(/\s+/).filter(Boolean).length : 0;
    totalWords += words;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
  }

  await pdfDoc.cleanup();

  const firstPageText = pages[0]?.text ?? '';
  const firstPageLines = firstPageText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cleanFileNameTitle = originalFileName
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const fallbackTitle =
    metadataTitle ||
    firstPageLines.find((l) => l.length > 10 && l.length < 180 && !/^abstract/i.test(l)) ||
    cleanFileNameTitle ||
    'Untitled Research Paper';

  const fallbackAuthors = metadataAuthor || 'Authors listed on Page 1';

  const abstractIdx = firstPageText.search(/\babstract\b/i);
  let fallbackAbstract = '';
  if (abstractIdx !== -1) {
    fallbackAbstract = firstPageText
      .slice(abstractIdx)
      .replace(/^abstract[:.\s-]*/i, '')
      .slice(0, 320)
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    fallbackAbstract = firstPageText.slice(0, 300).replace(/\s+/g, ' ').trim();
  }

  if (fallbackAbstract.length >= 295) {
    fallbackAbstract = `${fallbackAbstract.slice(0, 290).trim()}...`;
  }

  return {
    pages,
    totalPages,
    wordCount: totalWords,
    fallbackTitle,
    fallbackAuthors,
    fallbackAbstract: fallbackAbstract || 'No text abstract detected on the opening page.',
  };
}
