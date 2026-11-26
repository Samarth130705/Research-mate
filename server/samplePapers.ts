import PDFDocument from 'pdfkit';
import { extractPdfPages } from './pdfUtils.js';
import { hasPapersStore, savePaperDocument } from './storage.js';

interface SampleSection {
  heading: string;
  body: string[];
}

interface SamplePaperSpec {
  id: string;
  fileName: string;
  title: string;
  authors: string;
  affiliation: string;
  domain: string;
  year: string;
  pages: SampleSection[][];
}

const SAMPLE_PAPERS: SamplePaperSpec[] = [
  {
    id: 'sample-hybrid-rag-2025',
    fileName: 'Hybrid_Sparse_Dense_Retrieval_Academic_QA.pdf',
    title: 'Hybrid Sparse-Dense Retrieval with Reciprocal Rank Fusion for Grounded Academic Question Answering',
    authors: 'Ananya Verma, Rohan Nair, Kavita Deshmukh',
    affiliation: 'Department of Computer Science and Engineering, National Institute of Technology',
    domain: 'Information Retrieval & NLP',
    year: '2025',
    pages: [
      [
        {
          heading: 'Abstract',
          body: [
            'Large Language Models (LLMs) frequently hallucinate bibliographic details, numerical results, and methodological assumptions when answering questions over specialized scientific literature. Retrieval-Augmented Generation (RAG) mitigates ungrounded generation by conditioning answers on retrieved source passages, yet purely dense vector retrieval struggles with exact technical acronyms, dataset identifiers, and mathematical notation.',
            'In this paper, we propose HybScholar-RAG, a two-stage hybrid retrieval pipeline combining lexical BM25 scoring with domain-adapted SciBERT-BiEncoder dense embeddings via Reciprocal Rank Fusion (RRF), followed by a lightweight MiniLM Cross-Encoder reranker. Evaluated on the QASPER and SciFact academic benchmarks, HybScholar-RAG improves Top-5 passage recall by 11.4% over dense-only baselines and reduces unsupported claim rate from 18.2% to 4.7% while maintaining median end-to-end retrieval latency under 145 ms per query.',
          ],
        },
        {
          heading: '1. Introduction',
          body: [
            'Students and early-stage researchers spend considerable time parsing multi-page conference papers to extract datasets, experimental setups, and failure modes. Automated paper assistants can accelerate literature review, provided their outputs remain strictly verifiable against the underlying document.',
            'Purely sparse retrieval methods such as TF-IDF and Okapi BM25 excel at exact token matching for symbols like "F1@5", "RoBERTa-large", or chemical formulas, yet fail when queries paraphrase conceptual ideas. Conversely, dense bi-encoder models capture semantic similarity across paraphrases but often miss rare out-of-vocabulary tokens and exact hyperparameter strings.',
            'Our contributions are threefold: (1) we design a page-aware sliding-window chunking scheme (350 tokens with 60-token overlap) that preserves exact page indices for downstream citation verification; (2) we integrate Reciprocal Rank Fusion (k = 60) with cross-encoder reranking tailored to academic sections; and (3) we conduct an ablation and error analysis across two public scientific benchmarks.',
          ],
        },
      ],
      [
        {
          heading: '2. Methodology & System Architecture',
          body: [
            'The HybScholar-RAG pipeline operates in four sequential stages: Page-Indexed Ingestion, Dual-Path Indexing, Rank Fusion & Reranking, and Citation-Constrained Synthesis.',
            'Stage 1 — Page-Indexed Ingestion: Each PDF is parsed page-by-page using layout-aware text extraction to retain structural boundaries (Abstract, Methodology, Experiments, Limitations). Every chunk stores metadata (paper_id, page_number, section_hint) so generated answers can emit verifiable [p. X] citations.',
            'Stage 2 — Dual-Path Indexing: For sparse retrieval, we construct an inverted BM25 index (k1 = 1.5, b = 0.75) over lemmatized academic tokens while preserving technical acronyms. For dense retrieval, chunks are embedded into 768-dimensional vectors using a fine-tuned SciBERT-BiEncoder with cosine similarity search.',
            'Stage 3 — Reciprocal Rank Fusion & Reranking: Given top-40 candidate lists from BM25 and dense search, we compute the fused score RRF(d) = 1 / (60 + rank_BM25(d)) + 1 / (60 + rank_Dense(d)). The top-20 fused candidates are scored by a 6-layer Cross-Encoder (ms-marco-MiniLM-L-6-v2) to select the final k = 6 evidence passages.',
            'Stage 4 — Citation-Constrained Synthesis: The prompt enforces strict abstention: if retrieved passages lack the requested metric or claim, the generator must output an explicit unavailability notice rather than extrapolating from parametric memory.',
          ],
        },
      ],
      [
        {
          heading: '3. Datasets & Experimental Results',
          body: [
            'We evaluate our approach on two established scientific QA datasets: (a) QASPER (1,585 NLP papers with 5,049 information-seeking questions authored by domain readers), and (b) SciFact (1,409 scientific claims verified against PubMed abstracts with sentence-level rationales).',
            'Table 1 — Comparative Performance on QASPER (Test Split, k = 6 passages):',
            '  Method                     | Recall@5 | MRR@10 | Citation Precision | Latency (ms)',
            '  BM25 Only                  |   64.2%  |  0.512 |       79.4%        |     28 ms',
            '  Dense Bi-Encoder Only      |   71.8%  |  0.584 |       83.1%        |     52 ms',
            '  Hybrid RRF (No Reranker)   |   79.6%  |  0.641 |       89.5%        |     74 ms',
            '  HybScholar-RAG (RRF+Cross) |   83.2%  |  0.694 |       94.3%        |    142 ms',
            'On SciFact claim verification, HybScholar-RAG achieves 76.8% label accuracy (F1 = 0.754), outperforming dense-only retrieval by +5.9 percentage points. Human evaluation across 120 graduate-level queries confirmed that 94.3% of inline page citations accurately pointed to supporting sentences, and unsupported hallucinations dropped from 18.2% (zero-shot dense) to 4.7%.',
          ],
        },
      ],
      [
        {
          heading: '4. Limitations & Ethical Considerations',
          body: [
            'Despite strong text retrieval accuracy, HybScholar-RAG exhibits three notable limitations: (1) Multi-modal figures, complex LaTeX equations embedded as vector paths, and multi-row scanned tables are often skipped or linearized imperfectly by pure text PDF extractors; (2) Cross-encoder reranking introduces an additional 68 ms latency overhead per query, making real-time multi-document synthesis slower on CPU-only deployments; and (3) Evaluation was restricted to English computer science and biomedical corpora, leaving low-resource languages and humanities papers untested.',
            '5. Conclusion & Future Work',
            'We demonstrated that combining BM25 lexical matching, domain-tuned dense retrieval, and Reciprocal Rank Fusion with cross-encoder reranking substantially improves factual grounding and page-level citation precision for academic paper assistants. Future work will integrate vision-language table parsing for complex multi-column figures and adaptive query routing that skips cross-encoder reranking for simple factual lookups.',
          ],
        },
      ],
    ],
  },
  {
    id: 'sample-qlora-edge-2025',
    fileName: 'Quantized_LoRA_Edge_Transformer_Inference.pdf',
    title: 'Quantized Low-Rank Adaptation (QLoRA-Edge) for Resource-Constrained Transformer Inference',
    authors: 'Marcus Chen, Shruti Kulkarni, Tomas Alverez',
    affiliation: 'Embedded Machine Intelligence Lab, Institute of Technology',
    domain: 'Efficient Deep Learning & Systems',
    year: '2025',
    pages: [
      [
        {
          heading: 'Abstract',
          body: [
            'Fine-tuning 7B–8B parameter Large Language Models for specialized engineering domains typically requires high-memory server GPUs exceeding 32 GB VRAM, creating a barrier for student labs and edge deployments. While Low-Rank Adaptation (LoRA) reduces trainable parameter counts, storing frozen base weights in 16-bit precision still exceeds single consumer GPU limits.',
            'We present QLoRA-Edge, an empirical framework combining 4-bit NormalFloat (NF4) base weight quantization with rank-adaptive LoRA modules (r = 8 to 32) and paged AdamW optimizers. Across Llama-3-8B and Mistral-7B-v0.3 evaluated on MMLU, GSM8K, and HumanEval, QLoRA-Edge cuts peak training VRAM from 28.4 GB to 7.9 GB (72.2% reduction) while retaining 98.4% of full 16-bit LoRA accuracy.',
          ],
        },
        {
          heading: '1. Introduction',
          body: [
            'University research groups and final-year engineering teams frequently operate on single 8 GB to 12 GB consumer GPUs (such as RTX 3060 or RTX 4070 cards). Full parameter fine-tuning of a 7-billion parameter transformer requires maintaining weights, gradients, and optimizer states in memory, easily exceeding 110 GB in mixed precision.',
            'Standard LoRA freezes pre-trained weight matrices W0 and injects trainable low-rank decompositions deltaW = B * A, where rank r << min(d, k). However, inference and backward activation passes through W0 still demand ~14–16 GB solely for 16-bit base parameters. Building on 4-bit NormalFloat quantization and double quantization of scaling constants, our study systematically benchmarks rank sensitivity, latency overhead of on-the-fly dequantization, and downstream reasoning accuracy on compact GPUs.',
          ],
        },
      ],
      [
        {
          heading: '2. Methodology & Rank-Adaptive Formulation',
          body: [
            'Weight Representation: Pre-trained linear projection weights (q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj) are quantized offline into 4-bit NormalFloat (NF4), which assumes normally distributed weights within blocks of size 64. Blockwise quantization constants are themselves quantized to 8-bit floats (double quantization), saving an additional 0.37 bits per parameter.',
            'Rank-Adaptive LoRA Injection: Instead of applying a uniform rank r across all layers, QLoRA-Edge assigns r = 32 to upper attention and MLP layers (layers 20–32) where task-specific reasoning concentrates, and r = 8 to lower lexical layers (layers 1–19), keeping total trainable adapters under 0.42% of model parameters.',
            'Memory-Bounded Training Schedule: Gradient checkpointing is enabled at every transformer block, and optimizer states are offloaded to pinned host RAM during peak spikes via paged AdamW (learning rate 2e-4, cosine schedule, sequence length 2048, effective batch size 16).',
          ],
        },
      ],
      [
        {
          heading: '3. Benchmarks & Experimental Results',
          body: [
            'All experiments were conducted on a single NVIDIA RTX 4070 (12 GB VRAM) and verified on an RTX 3060 (12 GB) using three standard datasets: (1) MMLU (57-subject academic knowledge), (2) GSM8K (grade-school mathematical reasoning), and (3) HumanEval (Python code synthesis, pass@1). Fine-tuning was performed on the OpenHermes-2.5 instruction subset (50,000 samples, 2 epochs).',
            'Table 1 — Memory, Accuracy, and Inference Throughput on Llama-3-8B:',
            '  Configuration       | Peak VRAM | MMLU  | GSM8K | HumanEval | Tokens/sec',
            '  FP16 Full LoRA r=16 |  28.4 GB  | 67.8% | 78.4% |   61.2%   |  44.5 tok/s',
            '  Uniform NF4 r=8     |   7.4 GB  | 65.9% | 74.1% |   57.8%   |  36.2 tok/s',
            '  Uniform NF4 r=32    |   8.6 GB  | 66.7% | 76.9% |   59.9%   |  34.8 tok/s',
            '  QLoRA-Edge Adaptive |   7.9 GB  | 67.1% | 77.6% |   60.4%   |  35.9 tok/s',
            'On Mistral-7B-v0.3, QLoRA-Edge similarly reduced peak VRAM from 26.1 GB to 7.3 GB while achieving 64.3% on MMLU and 73.2% on GSM8K—retaining 98.4% of full 16-bit LoRA performance.',
          ],
        },
      ],
      [
        {
          heading: '4. Limitations & Failure Modes',
          body: [
            'Three practical constraints emerged during evaluation: (1) On-the-fly 4-bit to BF16 dequantization introduces a 19.3% inference throughput penalty (35.9 vs 44.5 tokens/sec) at batch size 1 compared to merged FP16 weights; (2) Mathematical multi-step reasoning (GSM8K) remains noticeably more sensitive to aggressive 4-bit quantization than general knowledge recall (MMLU); and (3) Merging 4-bit quantized base weights with LoRA adapters back into standalone 4-bit weights causes slight rounding drift unless re-quantized carefully.',
            '5. Conclusion',
            'QLoRA-Edge demonstrates that rank-adaptive 4-bit NormalFloat fine-tuning makes 7B–8B transformer adaptation practical on standard 8 GB–12 GB student and edge GPUs without sacrificing downstream reasoning quality. Future research should explore mixed 4-bit/8-bit sensitivity-aware quantization for attention value projections and hardware-fused dequantization kernels to eliminate inference latency overhead.',
          ],
        },
      ],
    ],
  },
];

function buildPdfBuffer(spec: SamplePaperSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 54,
      info: {
        Title: spec.title,
        Author: spec.authors,
        Subject: spec.domain,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    spec.pages.forEach((sections, pageIdx) => {
      if (pageIdx > 0) {
        doc.addPage();
      }

      if (pageIdx === 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`${spec.domain} · ${spec.year}`, {
          align: 'left',
        });
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(17).fillColor('#0F172A').text(spec.title, {
          lineGap: 3,
        });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10.5).fillColor('#334155').text(spec.authors);
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#64748B').text(spec.affiliation);
        doc.moveDown(0.8);
        doc.moveTo(54, doc.y).lineTo(541, doc.y).strokeColor('#CBD5E1').lineWidth(0.75).stroke();
        doc.moveDown(1);
      } else {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(`${spec.title.slice(0, 72)}...`, 54, 34, { align: 'left' });
        doc.moveDown(1.2);
      }

      for (const sec of sections) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A').text(sec.heading, {
          lineGap: 2,
        });
        doc.moveDown(0.4);
        for (const para of sec.body) {
          const isTableLine = para.startsWith('  ') || para.startsWith('Table ');
          doc
            .font(isTableLine && para.startsWith('  ') ? 'Courier' : 'Helvetica')
            .fontSize(isTableLine && para.startsWith('  ') ? 8.8 : 10.2)
            .fillColor('#1E293B')
            .text(para, {
              align: isTableLine ? 'left' : 'justify',
              lineGap: 3.5,
            });
          doc.moveDown(0.55);
        }
        doc.moveDown(0.4);
      }

      // Page footer
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(`Page ${pageIdx + 1} of ${spec.pages.length}`, 54, 768, {
          align: 'center',
          width: 487,
          lineBreak: false,
        });
    });

    doc.end();
  });
}

export async function seedSamplePapersIfEmpty(): Promise<void> {
  if (hasPapersStore()) return;

  for (const spec of SAMPLE_PAPERS) {
    const buffer = await buildPdfBuffer(spec);
    const extracted = await extractPdfPages(buffer, spec.fileName);
    savePaperDocument(
      {
        id: spec.id,
        title: spec.title,
        authors: spec.authors,
        domain: spec.domain,
        year: spec.year,
        fileName: spec.fileName,
        fileSize: buffer.length,
        totalPages: extracted.totalPages,
        wordCount: extracted.wordCount,
        abstractSnippet: extracted.fallbackAbstract,
        uploadedAt: new Date().toISOString(),
        isSample: true,
        pages: extracted.pages,
      },
      buffer
    );
  }
}
