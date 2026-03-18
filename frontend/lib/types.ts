// lib/types.ts — TypeScript type definitions for the Clariva application

export type SourceType = "yt" | "web" | "pdf" | "audio" | "video" | "text";

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Source {
  id: number;
  title: string;
  source_identifier: string;
  source_type?: string;
  summary?: string;
  owner_id?: number;
}

export interface Message {
  role: "user" | "ai";
  text: string;
  time: string;
  citation?: string;
  sourceTitle?: string;
  feedbackGiven?: 1 | -1;
  isStreaming?: boolean;
}

export type Conversations = Record<string, Message[]>;

export interface ChatResponse {
  answer: string;
  context_chunk?: string;
}

export interface FeedbackRequest {
  source_id: number;
  question: string;
  answer: string;
  rating: 1 | -1;
}

export interface FeedbackStat {
  source_id: number;
  source_title: string;
  total_feedback: number;
  positive: number;
  negative: number;
  accuracy_percent: number;
}

export interface Note {
  id: number;
  source_id: number;
  source_title: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface SourceStats {
  word_count: number;
  read_time_minutes: number;
  chunk_count: number;
  retrieval_mode: string;
}

