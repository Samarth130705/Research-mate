import React from 'react';

interface PageCitationsProps {
  pages?: number[];
  prefix?: string;
  onJumpToPage?: (page: number) => void;
}

export function PageCitations({ pages, prefix = 'p.', onJumpToPage }: PageCitationsProps) {
  if (!pages || pages.length === 0) return null;

  const uniquePages = Array.from(new Set(pages)).filter((p) => Number.isFinite(p) && p > 0);
  if (uniquePages.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {uniquePages.map((page) =>
        onJumpToPage ? (
          <button
            key={page}
            type="button"
            onClick={() => onJumpToPage(page)}
            className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono tabular-nums font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors cursor-pointer whitespace-nowrap"
            title={`Jump to page ${page}`}
          >
            {prefix} {page}
          </button>
        ) : (
          <span
            key={page}
            className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono tabular-nums font-medium text-slate-600 bg-slate-100 rounded border border-slate-200 whitespace-nowrap"
          >
            {prefix} {page}
          </span>
        )
      )}
    </span>
  );
}

function renderInlineTokens(
  text: string,
  onJumpToPage?: (page: number) => void
): React.ReactNode[] {
  // Tokenize citations [p. 3], [pp. 2-4], [p. 1, p. 3], bold **...**, and inline `code`
  const tokenRegex =
    /(\[p{1,2}\.\s*\d+(?:\s*(?:[-–,]\s*(?:p{1,2}\.\s*)?\d+))*\]|\*\*[^*]+\*\*|`[^`]+`)/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    const citationMatch = part.match(
      /^\[p{1,2}\.\s*(\d+)(?:\s*(?:[-–,]\s*(?:p{1,2}\.\s*)?\d+))*\]$/i
    );
    if (citationMatch) {
      const firstPage = Number(citationMatch[1]);
      return onJumpToPage ? (
        <button
          key={idx}
          type="button"
          onClick={() => onJumpToPage(firstPage)}
          className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors cursor-pointer align-baseline"
          title={`Open page ${firstPage} in PDF Reader`}
        >
          {part.slice(1, -1)}
        </button>
      ) : (
        <span
          key={idx}
          className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[11px] font-mono tabular-nums font-medium text-slate-700 bg-slate-100 rounded border border-slate-200 align-baseline"
        >
          {part.slice(1, -1)}
        </span>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 text-[12px] font-mono bg-slate-100 text-slate-800 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

interface CitationMarkdownProps {
  content: string;
  onJumpToPage?: (page: number) => void;
  className?: string;
}

export function CitationMarkdown({
  content,
  onJumpToPage,
  className = '',
}: CitationMarkdownProps) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0 || !listType) return;
    if (listType === 'ul') {
      blocks.push(
        <ul key={keyPrefix} className="list-disc pl-5 space-y-1.5 text-slate-700">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineTokens(item, onJumpToPage)}
            </li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={keyPrefix} className="list-decimal pl-5 space-y-1.5 text-slate-700">
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineTokens(item, onJumpToPage)}
            </li>
          ))}
        </ol>
      );
    }
    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`list-${idx}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (listType === 'ol') flushList(`list-switch-${idx}`);
      listType = 'ul';
      listItems.push(bulletMatch[1]);
      return;
    }

    const numMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numMatch) {
      if (listType === 'ul') flushList(`list-switch-${idx}`);
      listType = 'ol';
      listItems.push(numMatch[1]);
      return;
    }

    flushList(`list-end-${idx}`);

    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <h4 key={`h-${idx}`} className="text-sm font-semibold text-slate-900 pt-1">
          {renderInlineTokens(headingMatch[1], onJumpToPage)}
        </h4>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed text-slate-700">
        {renderInlineTokens(line, onJumpToPage)}
      </p>
    );
  });

  flushList('list-final');

  return <div className={`space-y-2.5 text-[14px] ${className}`}>{blocks}</div>;
}
