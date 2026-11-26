import type {
  ChatMessage,
  ConceptExplanationResult,
  McqQuestionItem,
  PaperAnalysisBundle,
  PaperComparisonResult,
  PaperDocument,
  PaperExtractionResult,
  PaperMetadata,
  PaperSummaryResult,
  ResearchGapsResult,
  VivaQuestionItem,
} from '../types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchPapers(): Promise<PaperMetadata[]> {
  const data = await requestJson<{ papers: PaperMetadata[] }>('/api/papers');
  return data.papers;
}

export async function fetchPaperDetail(
  id: string
): Promise<{ paper: PaperDocument; analysis: PaperAnalysisBundle }> {
  return requestJson<{ paper: PaperDocument; analysis: PaperAnalysisBundle }>(
    `/api/papers/${encodeURIComponent(id)}`
  );
}

export async function uploadPdfPaper(
  file: File
): Promise<{ paper: PaperDocument; analysis: PaperAnalysisBundle }> {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<{ paper: PaperDocument; analysis: PaperAnalysisBundle }>('/api/papers/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function deletePaper(id: string): Promise<void> {
  await requestJson<{ deleted: boolean }>(`/api/papers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function sendChatQuestion(
  paperId: string,
  question: string
): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  chatHistory: ChatMessage[];
}> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

export async function clearPaperChat(paperId: string): Promise<void> {
  await requestJson(`/api/papers/${encodeURIComponent(paperId)}/chat`, {
    method: 'DELETE',
  });
}

export async function fetchOrGenerateSummary(
  paperId: string,
  level: 'executive' | 'simple' | 'detailed',
  force = false
): Promise<{ summary: PaperSummaryResult; cached: boolean }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, force }),
  });
}

export async function explainConcept(
  paperId: string,
  concept: string
): Promise<{ explanation: ConceptExplanationResult }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept }),
  });
}

export async function fetchOrGenerateExtraction(
  paperId: string,
  force = false
): Promise<{ extraction: PaperExtractionResult; cached: boolean }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
}

export async function fetchOrGenerateViva(
  paperId: string,
  focusTopic?: string,
  force = false
): Promise<{ vivaQuestions: VivaQuestionItem[]; cached: boolean }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/viva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ focusTopic, force }),
  });
}

export async function fetchOrGenerateMcqs(
  paperId: string,
  count = 6,
  force = false
): Promise<{ mcqs: McqQuestionItem[]; cached: boolean }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/mcqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, force }),
  });
}

export async function fetchOrGenerateGaps(
  paperId: string,
  force = false
): Promise<{ researchGaps: ResearchGapsResult; cached: boolean }> {
  return requestJson(`/api/papers/${encodeURIComponent(paperId)}/gaps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
}

export async function fetchSavedComparisons(): Promise<PaperComparisonResult[]> {
  const data = await requestJson<{ comparisons: PaperComparisonResult[] }>('/api/comparisons');
  return data.comparisons;
}

export async function comparePapers(
  paperAId: string,
  paperBId: string,
  force = false
): Promise<{ comparison: PaperComparisonResult; cached: boolean }> {
  return requestJson('/api/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paperAId, paperBId, force }),
  });
}
