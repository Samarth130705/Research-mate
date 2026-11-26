import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChatMessage,
  ConceptExplanationResult,
  McqQuestionItem,
  PaperComparisonResult,
  PaperDocument,
  PaperExtractionResult,
  PaperSummaryResult,
  ResearchGapsResult,
  VivaQuestionItem,
} from '../src/types.js';

const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add a valid Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 800 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function formatPaperContext(paper: PaperDocument, maxChars = 180000): string {
  const header = `PAPER TITLE: ${paper.title}\nAUTHORS: ${paper.authors}\nTOTAL PAGES: ${paper.totalPages}\n\n`;
  let body = '';
  for (const page of paper.pages) {
    const block = `=== PAGE ${page.pageNumber} ===\n${page.text}\n\n`;
    if (body.length + block.length > maxChars) {
      body += `\n[Note: Remaining pages truncated due to context size limit.]`;
      break;
    }
    body += block;
  }
  return header + body;
}

function parseJsonSafe<T>(rawText: string | undefined, contextLabel: string): T {
  if (!rawText) {
    throw new Error(`Empty response received from AI while generating ${contextLabel}.`);
  }
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse structured ${contextLabel} output from AI.`);
  }
}

export async function extractPaperMetadataWithAi(
  fallback: { title: string; authors: string; abstract: string },
  firstTwoPagesText: string
): Promise<{ title: string; authors: string; domain: string; year: string; abstractSnippet: string }> {
  try {
    const ai = getAiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Extract clean bibliographic metadata strictly from the opening pages of this research paper.\n\nOPENING TEXT:\n${firstTwoPagesText.slice(0, 7000)}`,
        config: {
          systemInstruction:
            'Extract only metadata present in the text. If year or authors are missing, return "Not specified". Keep domain concise (2-4 words, e.g. "Computer Vision", "Natural Language Processing"). Keep abstractSnippet under 260 characters.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.STRING },
              domain: { type: Type.STRING },
              year: { type: Type.STRING },
              abstractSnippet: { type: Type.STRING },
            },
            required: ['title', 'authors', 'domain', 'year', 'abstractSnippet'],
          },
        },
      })
    );
    return parseJsonSafe(response.text, 'paper metadata');
  } catch {
    return {
      title: fallback.title,
      authors: fallback.authors,
      domain: 'Academic Research',
      year: 'Uploaded PDF',
      abstractSnippet: fallback.abstract,
    };
  }
}

export async function chatWithPaper(
  paper: PaperDocument,
  history: ChatMessage[],
  question: string
): Promise<{ answer: string; notFoundInPaper: boolean }> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const systemInstruction = `You are ResearchMate AI, an academic research paper assistant.
Your sole source of truth is the page-indexed text of the uploaded research paper provided below.

STRICT GROUNDING RULES:
1. Answer ONLY using facts, figures, methods, equations, datasets, and claims explicitly present in the paper text below.
2. Cite exact page numbers inline using [p. X] (for example: [p. 2] or [p. 3]) right after every claim or number.
3. If the user asks about anything NOT present in the uploaded paper (missing metrics, external comparisons, unmentioned datasets, or unrelated topics), you MUST set "notFoundInPaper" to true and clearly state in "answer": "This information is not found in the uploaded paper." followed by what related topic (if any) the paper actually discusses with page citations.
4. Never fabricate citations, authors, benchmarks, or numbers.
5. Format "answer" cleanly using concise Markdown (short paragraphs, bullet points when listing items, bold key terms).

${paperContext}`;

  const recentHistory = history.slice(-8).map((msg) => ({
    role: msg.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: msg.content }],
  }));

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: [...recentHistory, { role: 'user', parts: [{ text: question }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'Markdown answer strictly grounded in the paper with inline [p. X] citations.',
            },
            notFoundInPaper: {
              type: Type.BOOLEAN,
              description: 'True if the requested information is missing from the uploaded paper.',
            },
          },
          required: ['answer', 'notFoundInPaper'],
        },
      },
    })
  );

  return parseJsonSafe<{ answer: string; notFoundInPaper: boolean }>(response.text, 'chat answer');
}

export async function generatePaperSummary(
  paper: PaperDocument,
  level: 'executive' | 'simple' | 'detailed'
): Promise<PaperSummaryResult> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const levelGuidance =
    level === 'simple'
      ? 'Write in crystal-clear, student-friendly plain language (avoid dense jargon, or immediately explain any technical term in plain English) while staying 100% faithful to the paper.'
      : level === 'detailed'
        ? 'Provide a thorough technical summary covering motivation, architecture/formulation, datasets, quantitative results, and limitations.'
        : 'Provide a crisp, high-signal executive summary ideal for quick academic review.';

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate a ${level} summary of this paper.\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI. ${levelGuidance}
Cite exact integer page numbers in the "pages" arrays (1 to ${paper.totalPages}) and include inline [p. X] citations in the overview prose where helpful. Never invent facts not in the paper.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['point', 'pages'],
              },
            },
            sectionBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['section', 'summary', 'pages'],
              },
            },
          },
          required: ['overview', 'keyTakeaways', 'sectionBreakdown'],
        },
      },
    })
  );

  const parsed = parseJsonSafe<Omit<PaperSummaryResult, 'level' | 'generatedAt'>>(
    response.text,
    'paper summary'
  );

  return {
    level,
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function explainConceptInPaper(
  paper: PaperDocument,
  concept: string
): Promise<ConceptExplanationResult> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Explain the concept "${concept}" in simple, intuitive language based on how it appears in this paper.\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI. Explain complex academic concepts in clear, accessible language for undergraduate/graduate students.
Ground "paperContext" and "pages" strictly in the uploaded paper. If the concept is NOT mentioned in the paper, state clearly in paperContext that the term does not appear directly in the paper while still giving a brief plain-language definition and marking pages as [].`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concept: { type: Type.STRING },
            simpleExplanation: { type: Type.STRING },
            analogy: { type: Type.STRING },
            paperContext: { type: Type.STRING },
            pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            relatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'concept',
            'simpleExplanation',
            'analogy',
            'paperContext',
            'pages',
            'relatedConcepts',
          ],
        },
      },
    })
  );

  return parseJsonSafe<ConceptExplanationResult>(response.text, 'concept explanation');
}

export async function extractStructuredInsights(
  paper: PaperDocument
): Promise<PaperExtractionResult> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Extract the structured research components (Methodology, Datasets, Key Findings, Limitations, and Conclusions) from this paper.\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI. Extract ONLY information explicitly stated in the paper, with exact integer page numbers in every "pages" array.
If a section (such as datasets or limitations) is genuinely absent from the paper, include a single honest entry stating it was not reported in the paper with pages: []. Never fabricate metrics or datasets.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            methodology: {
              type: Type.OBJECT,
              properties: {
                overview: { type: Type.STRING },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step: { type: Type.STRING },
                      detail: { type: Type.STRING },
                      pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    },
                    required: ['step', 'detail', 'pages'],
                  },
                },
              },
              required: ['overview', 'steps'],
            },
            datasets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  usage: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['name', 'description', 'usage', 'pages'],
              },
            },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  finding: { type: Type.STRING },
                  metricOrEvidence: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['finding', 'metricOrEvidence', 'pages'],
              },
            },
            limitations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  limitation: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['limitation', 'impact', 'pages'],
              },
            },
            conclusions: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                contributions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING },
                      pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    },
                    required: ['item', 'pages'],
                  },
                },
              },
              required: ['summary', 'contributions'],
            },
          },
          required: ['methodology', 'datasets', 'keyFindings', 'limitations', 'conclusions'],
        },
      },
    })
  );

  const parsed = parseJsonSafe<Omit<PaperExtractionResult, 'generatedAt'>>(
    response.text,
    'structured extraction'
  );

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function compareTwoPapers(
  paperA: PaperDocument,
  paperB: PaperDocument
): Promise<PaperComparisonResult> {
  const ai = getAiClient();
  const contextA = formatPaperContext(paperA, 85000);
  const contextB = formatPaperContext(paperB, 85000);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Compare Paper A and Paper B thoroughly across core research dimensions.\n\n--- PAPER A ---\n${contextA}\n\n--- PAPER B ---\n${contextB}`,
      config: {
        systemInstruction: `You are ResearchMate AI. Compare Paper A and Paper B strictly from their provided texts.
Include at least 6 comparison dimensions: Research Objective, Methodology & Architecture, Datasets & Benchmarks, Quantitative Findings, Strengths, and Limitations.
Cite exact page numbers in paperAPages (1..${paperA.totalPages}) and paperBPages (1..${paperB.totalPages}). If one paper lacks a metric or detail, state that transparently instead of guessing.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveVerdict: { type: Type.STRING },
            dimensions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING },
                  paperAPoint: { type: Type.STRING },
                  paperAPages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  paperBPoint: { type: Type.STRING },
                  paperBPages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  synthesis: { type: Type.STRING },
                },
                required: [
                  'dimension',
                  'paperAPoint',
                  'paperAPages',
                  'paperBPoint',
                  'paperBPages',
                  'synthesis',
                ],
              },
            },
            similarities: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendation: { type: Type.STRING },
          },
          required: [
            'executiveVerdict',
            'dimensions',
            'similarities',
            'keyDifferences',
            'recommendation',
          ],
        },
      },
    })
  );

  const parsed = parseJsonSafe<
    Omit<PaperComparisonResult, 'paperAId' | 'paperBId' | 'paperATitle' | 'paperBTitle' | 'generatedAt'>
  >(response.text, 'paper comparison');

  return {
    paperAId: paperA.id,
    paperBId: paperB.id,
    paperATitle: paperA.title,
    paperBTitle: paperB.title,
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateVivaQuestions(
  paper: PaperDocument,
  focusTopic?: string
): Promise<VivaQuestionItem[]> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const focusPrompt = focusTopic?.trim()
    ? `Focus especially on: "${focusTopic.trim()}".`
    : 'Cover methodology, design choices, metrics, edge cases, and limitations.';

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate 6 realistic academic viva / oral defense questions with grounded model answers and examiner follow-up tips. ${focusPrompt}\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI acting as a fair, rigorous engineering thesis examiner.
Generate 6 viva questions (2 Foundational, 2 Intermediate, 2 Advanced). Every expectedAnswer must be strictly grounded in the uploaded paper and cite exact page numbers in "pages".`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ['Foundational', 'Intermediate', 'Advanced'] },
              question: { type: Type.STRING },
              expectedAnswer: { type: Type.STRING },
              followUpTip: { type: Type.STRING },
              pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            },
            required: ['id', 'difficulty', 'question', 'expectedAnswer', 'followUpTip', 'pages'],
          },
        },
      },
    })
  );

  return parseJsonSafe<VivaQuestionItem[]>(response.text, 'viva questions');
}

export async function generateMcqQuiz(
  paper: PaperDocument,
  count = 6
): Promise<McqQuestionItem[]> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate ${count} multiple-choice questions (4 options each) testing genuine comprehension of this research paper.\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI. Every question, option, correctIndex (0-3), and explanation MUST be strictly grounded in the uploaded paper, with exact page references in "pages". Ensure distractors are plausible but unambiguously incorrect according to the paper.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            },
            required: ['id', 'question', 'options', 'correctIndex', 'explanation', 'pages'],
          },
        },
      },
    })
  );

  const items = parseJsonSafe<McqQuestionItem[]>(response.text, 'MCQ quiz');
  return items.map((item, idx) => ({
    ...item,
    id: item.id || `mcq-${idx + 1}`,
    options: (item.options.slice(0, 4) as [string, string, string, string]),
    correctIndex: Math.min(3, Math.max(0, item.correctIndex)),
  }));
}

export async function identifyResearchGaps(paper: PaperDocument): Promise<ResearchGapsResult> {
  const ai = getAiClient();
  const paperContext = formatPaperContext(paper);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Identify concrete research gaps and actionable future research directions grounded in this paper.\n\n${paperContext}`,
      config: {
        systemInstruction: `You are ResearchMate AI helping a final-year CSE student or researcher spot rigorous research gaps and future thesis directions.
Every gap must cite exact evidence and page numbers from the paper (limitations, dataset scope, assumptions, latency/accuracy trade-offs, unaddressed baselines). Never invent limitations that contradict the paper.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gaps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  evidenceFromPaper: { type: Type.STRING },
                  pages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                  severity: { type: Type.STRING, enum: ['High', 'Medium'] },
                },
                required: ['title', 'evidenceFromPaper', 'pages', 'severity'],
              },
            },
            futureDirections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hypothesis: { type: Type.STRING },
                  suggestedApproach: { type: Type.STRING },
                  groundedInPages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ['title', 'hypothesis', 'suggestedApproach', 'groundedInPages'],
              },
            },
          },
          required: ['gaps', 'futureDirections'],
        },
      },
    })
  );

  const parsed = parseJsonSafe<Omit<ResearchGapsResult, 'generatedAt'>>(
    response.text,
    'research gaps'
  );

  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  };
}
