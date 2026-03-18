// lib/api.ts — API client with JWT auth, auto-refresh on 401, streaming SSE, and feedback endpoints

import type { ChatResponse, FeedbackRequest, FeedbackStat, Source, TokenResponse, User, Note, SourceStats } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || "https://my-ai-worker.pritam-kundu.workers.dev";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}

async function tryRefreshToken(): Promise<string | null> {
  if (!refreshToken) return null;

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data = (await res.json()) as { access_token: string };
      accessToken = data.access_token;
      return accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
  skipAuth?: boolean;
}

async function hFetch<T>(endpoint: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body = null, isFormData = false, skipAuth = false } = opts;

  const doFetch = async (token: string | null): Promise<Response> => {
    const config: RequestInit = { method, headers: {} };
    const headers = config.headers as Record<string, string>;

    if (token && !skipAuth) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (body) {
      if (isFormData) {
        config.body = body as FormData;
      } else {
        headers["Content-Type"] = "application/json";
        config.body = JSON.stringify(body);
      }
    }

    return fetch(`${API_BASE_URL}${endpoint}`, config);
  };

  let res = await doFetch(accessToken);

  // Auto-refresh on 401
  if (res.status === 401 && !skipAuth && refreshToken) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.detail && typeof err.detail === "object") {
      throw err.detail; // Throw structured object directly
    }
    // Handle stringified JSON in detail (FastAPI sometimes does this)
    if (typeof err.detail === "string") {
      try {
        const parsed = JSON.parse(err.detail);
        if (parsed.error && typeof parsed === "object") {
          throw parsed;
        }
      } catch {
        // Not JSON, continue to generic error
      }
    }
    throw new Error((err as { detail?: string }).detail || `Error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export type StreamCallback = (token: string) => void;
export type StreamDoneCallback = (sources?: string[]) => void;
export type StreamErrorCallback = (error: string) => void;

// Helper: fetch with auto-refresh on 401
async function fetchWithRefresh(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let res = await fetch(url, init);

  if (res.status === 401 && refreshToken) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    }
  }

  return res;
}

// Call Cloudflare Worker directly from browser for AI streaming
async function callCloudflareWorker(
  context: string,
  question: string,
  onToken: StreamCallback,
  onDone: StreamDoneCallback,
  onError: StreamErrorCallback,
): Promise<void> {
  try {
    const response = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, question }),
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No response stream');

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(payload);
          if (parsed.response !== undefined) {
            onToken(parsed.response);
          } else if (parsed.token !== undefined) {
            onToken(parsed.token);
          }
        } catch {
          // raw text chunk, emit directly
          if (trimmed.length > 6) {
            onToken(payload);
          }
        }
      }
    }

    onDone();
  } catch (err: unknown) {
    onError(err instanceof Error ? err.message : 'Streaming failed');
  }
}

export const api = {
  register: (name: string, email: string, password: string) =>
    hFetch<User>("/register", {
      method: "POST",
      body: { name, email, password },
      skipAuth: true,
    }),

  login: async (email: string, password: string): Promise<TokenResponse> => {
    const response = await hFetch<TokenResponse>("/token", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  logout: async (): Promise<void> => {
    if (refreshToken) {
      try {
        await hFetch<{ message: string }>("/logout", {
          method: "POST",
          body: { refresh_token: refreshToken },
        });
      } catch {
        // Ignore logout errors
      }
    }
    clearTokens();
  },

  getSources: (userId: number) => hFetch<Source[]>(`/sources/${userId}`),

  processUrl: (url: string) =>
    hFetch<Source>("/process-source", {
      method: "POST",
      body: { url },
    }),

  processPdf: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return hFetch<Source>("/process-pdf-upload", {
      method: "POST",
      body: fd,
      isFormData: true,
    });
  },

  processTextUpload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return hFetch<Source>("/process-text-upload", {
      method: "POST",
      body: fd,
      isFormData: true,
    });
  },

  uploadAudio: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/process-audio-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Audio/video upload failed");
    }
    return res.json();
  },

  deleteSource: (sourceId: number) =>
    hFetch<void>(`/sources/${sourceId}`, { method: "DELETE" }),

  chatSync: (sourceIdentifier: string, question: string) =>
    hFetch<ChatResponse>("/chat/sync", {
      method: "POST",
      body: { source_identifier: sourceIdentifier, question },
    }),

  streamChat: async (
    sourceIdentifier: string,
    question: string,
    onToken: StreamCallback,
    onDone: StreamDoneCallback,
    onError: StreamErrorCallback,
  ) => {
    try {
      // Step 1: Get context from backend
      const contextRes = await fetchWithRefresh(
        `${API_BASE_URL}/chat/context`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            source_identifier: sourceIdentifier,
            question,
          }),
        },
      );
      if (!contextRes.ok) {
        const err = await contextRes.json().catch(() => ({}));
        onError((err as { detail?: string }).detail || 'Failed to get context');
        return;
      }
      const { context, question: q } = await contextRes.json();

      // Step 2: Call Cloudflare Worker directly from browser
      await callCloudflareWorker(context, q, onToken, onDone, onError);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Chat failed');
    }
  },

  streamChatMulti: async (
    question: string,
    sourceIds: number[] | undefined,
    onToken: StreamCallback,
    onDone: StreamDoneCallback,
    onError: StreamErrorCallback,
  ) => {
    try {
      // Step 1: Get context from backend
      const contextRes = await fetchWithRefresh(
        `${API_BASE_URL}/chat/multi/context`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ question, source_ids: sourceIds }),
        },
      );
      if (!contextRes.ok) {
        const err = await contextRes.json().catch(() => ({}));
        onError((err as { detail?: string }).detail || 'Failed to get context');
        return;
      }
      const { context, question: q } = await contextRes.json();

      // Step 2: Call Cloudflare Worker directly from browser
      await callCloudflareWorker(context, q, onToken, onDone, onError);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Chat failed');
    }
  },

  sendFeedback: (feedback: FeedbackRequest) =>
    hFetch<{ id: number; message: string }>("/feedback", {
      method: "POST",
      body: feedback,
    }),

  getFeedbackStats: () =>
    hFetch<FeedbackStat[]>(`/feedback/stats`),

  googleAuth: async (token: string): Promise<TokenResponse> => {
    const response = await hFetch<TokenResponse>("/auth/google", {
      method: "POST",
      body: { token },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  verifyOtp: async (email: string, token: string, new_password: string): Promise<TokenResponse> => {
    const response = await hFetch<TokenResponse>("/auth/verify-otp", {
      method: "POST",
      body: { email, token, new_password },
      skipAuth: true,
    });
    setTokens(response.access_token, response.refresh_token);
    return response;
  },

  forgotPassword: (email: string) =>
    hFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
      skipAuth: true,
    }),

  resetPassword: (token: string, new_password: string) =>
    hFetch<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: { token, new_password },
      skipAuth: true,
    }),

  getNotes: () => hFetch<Note[]>("/notes"),

  createNote: (source_id: number, question: string, answer: string) =>
    hFetch<Note>("/notes", {
      method: "POST",
      body: { source_id, question, answer },
    }),

  deleteNote: (noteId: number) =>
    hFetch<{ message: string }>(`/notes/${noteId}`, { method: "DELETE" }),

  getSourceStats: (sourceId: number) =>
    hFetch<SourceStats>(`/sources/${sourceId}/stats`),

  getSourceChunks: (sourceId: number) =>
    hFetch<{ chunks: string[] }>(`/sources/${sourceId}/chunks`),
};
