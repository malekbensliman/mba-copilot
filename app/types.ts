// Types for MBA Copilot

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface Source {
  text: string;
  score: number;
  filename: string;
  document_id: string;
}

export interface Document {
  id: string;
  filename: string;
  chunks: number;
  uploaded_at: string;
}

export interface ChatRequest {
  message: string;
  history?: { role: string; content: string }[];
  settings?: ChatSettings;
  document_ids?: string[]; // Filter to specific documents
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface UploadResponse {
  success: boolean;
  document_id: string;
  filename: string;
  chunks: number;
}

export interface ExtractedChunk {
  text: string;
  chunk_index: number;
}

/** Phase 1 of batched ingestion: parsed chunks the browser embeds in batches. */
export interface ExtractResponse {
  document_id: string;
  filename: string;
  uploaded_at: string;
  total_chunks: number;
  chunks: ExtractedChunk[];
}

export interface DocumentsResponse {
  documents: Document[];
}

export interface DiagnosticsCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DiagnosticsResult {
  ok: boolean;
  checks: DiagnosticsCheck[];
}

// Settings that can be changed without re-processing documents
export interface ChatSettings {
  chat_model: string;
  top_k: number;
  min_score: number;
  system_prompt: string;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  chat_model: 'gpt-4o-mini',
  top_k: 8,
  min_score: 0.3,
  system_prompt: `You are an intelligent assistant for MBA students. Your role is to:
- Help students understand their course materials
- Explain concepts clearly and concisely
- Connect ideas across different readings
- Provide practical business examples when relevant

When answering questions:
1. Base your answers primarily on the provided context from the student's documents
2. When context is available, cite which documents you're drawing from
3. If the context is limited but you have relevant knowledge, you may supplement with general business knowledge while noting what comes from the documents vs. general knowledge
4. Use clear, professional language appropriate for business school`,
};

export const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, affordable)' },
  { value: 'gpt-4o', label: 'GPT-4o (Most capable)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fastest)' },
];