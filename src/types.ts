export interface PaperPage {
  pageNumber: number;
  text: string;
}

export interface PaperMetadata {
  id: string;
  title: string;
  authors: string;
  domain: string;
  year: string;
  fileName: string;
  fileSize: number;
  totalPages: number;
  wordCount: number;
  abstractSnippet: string;
  uploadedAt: string;
  isSample?: boolean;
}

export interface PaperDocument extends PaperMetadata {
  pages: PaperPage[];
}

export interface ChatCitation {
  page: number;
  excerpt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  notFoundInPaper?: boolean;
}

export interface PaperSummaryResult {
  level: 'executive' | 'simple' | 'detailed';
  overview: string;
  keyTakeaways: Array<{ point: string; pages: number[] }>;
  sectionBreakdown: Array<{ section: string; summary: string; pages: number[] }>;
  generatedAt: string;
}

export interface ConceptExplanationResult {
  concept: string;
  simpleExplanation: string;
  analogy: string;
  paperContext: string;
  pages: number[];
  relatedConcepts: string[];
}

export interface PaperExtractionResult {
  methodology: {
    overview: string;
    steps: Array<{ step: string; detail: string; pages: number[] }>;
  };
  datasets: Array<{
    name: string;
    description: string;
    usage: string;
    pages: number[];
  }>;
  keyFindings: Array<{
    finding: string;
    metricOrEvidence: string;
    pages: number[];
  }>;
  limitations: Array<{
    limitation: string;
    impact: string;
    pages: number[];
  }>;
  conclusions: {
    summary: string;
    contributions: Array<{ item: string; pages: number[] }>;
  };
  generatedAt: string;
}

export interface PaperComparisonResult {
  paperAId: string;
  paperBId: string;
  paperATitle: string;
  paperBTitle: string;
  executiveVerdict: string;
  dimensions: Array<{
    dimension: string;
    paperAPoint: string;
    paperAPages: number[];
    paperBPoint: string;
    paperBPages: number[];
    synthesis: string;
  }>;
  similarities: string[];
  keyDifferences: string[];
  recommendation: string;
  generatedAt: string;
}

export interface VivaQuestionItem {
  id: string;
  difficulty: 'Foundational' | 'Intermediate' | 'Advanced';
  question: string;
  expectedAnswer: string;
  followUpTip: string;
  pages: number[];
}

export interface McqQuestionItem {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  pages: number[];
}

export interface ResearchGapsResult {
  gaps: Array<{
    title: string;
    evidenceFromPaper: string;
    pages: number[];
    severity: 'High' | 'Medium';
  }>;
  futureDirections: Array<{
    title: string;
    hypothesis: string;
    suggestedApproach: string;
    groundedInPages: number[];
  }>;
  generatedAt: string;
}

export interface PaperAnalysisBundle {
  paperId: string;
  summaries: Partial<Record<'executive' | 'simple' | 'detailed', PaperSummaryResult>>;
  extraction?: PaperExtractionResult;
  vivaQuestions?: VivaQuestionItem[];
  mcqs?: McqQuestionItem[];
  researchGaps?: ResearchGapsResult;
  chatHistory: ChatMessage[];
}

export type WorkspaceTab =
  | 'dashboard'
  | 'library'
  | 'reader'
  | 'compare'
  | 'tools';
