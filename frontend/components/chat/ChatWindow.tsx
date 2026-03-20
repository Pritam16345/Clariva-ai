"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Trash2, Download, Layers, PanelRightClose, PanelRightOpen, ExternalLink, Headphones } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getSourceType, getSourceTypeLabel, formatTime } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { api, getAccessToken } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";
import { ChatInput } from "./ChatInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL || "https://my-ai-worker.pritam-kundu.workers.dev";

const typeBadgeMap: Record<string, string> = {
  yt: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border-[#fca5a5]/30",
  web: "text-[#93c5fd] bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.3)]",
  pdf: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)]",
  audio: "text-[#b8aef8] bg-[rgba(124,106,245,0.12)] border-[rgba(124,106,245,0.35)]",
  video: "text-[#b8aef8] bg-[rgba(124,106,245,0.1)] border-[rgba(124,106,245,0.3)]",
  text: "text-[#d1d5db] bg-[rgba(107,114,128,0.1)] border-[rgba(107,114,128,0.3)]",
};

export function ChatWindow() {
  const {
    allSources,
    activeSource,
    currentUser,
    conversations,
    addMessage,
    updateLastMessage,
    clearConversation,
    isStreaming,
    setIsStreaming,
    isMultiSourceMode,
    isStudioOpen,
    setIsStudioOpen,
    selectedSourceIds,
    clearSourceSelection,
  } = useAppStore();

  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Determine current active source obj for single-chat context
  const activeSourceObj = selectedSourceIds.length === 1
    ? allSources.find(s => s.id === selectedSourceIds[0]) || activeSource
    : activeSource;

  const sourceId = selectedSourceIds.length > 1
    ? "__multi__"
    : (activeSourceObj?.id?.toString() ?? "");

  const messages = conversations[sourceId] || [];
  const type = activeSourceObj ? getSourceType(activeSourceObj) : "web";

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    if (!currentUser) return;
    if (isStreaming) return;

    const question = inputValue.trim();
    if (!question || question.length > 500) return;

    setInputValue("");

    addMessage(sourceId, {
      role: "user",
      text: question,
      time: formatTime(),
    });

    addMessage(sourceId, {
      role: "ai",
      text: "",
      time: formatTime(),
      isStreaming: true,
    });

    setIsStreaming(true);

    const onToken = (token: string) => {
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        text: msg.text + token,
      }));
    };

    const onDone = (sources?: string[]) => {
      // In a real app we'd get a citation chunk from backend.
      // For now we simulate that source/citation is returned.
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        isStreaming: false,
        sourceTitle: sources ? sources.join(", ") : undefined,
      }));
      setIsStreaming(false);

      // Hack to attach citation if we're simulating NotebookLM
      if (!isMultiSourceMode && activeSource && msgHasText(sourceId)) {
        setTimeout(() => getSourceChunksAndAttachCitation(activeSource.id), 500);
      }
    };

    const onError = (error: string) => {
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        text: `Error: ${error}`,
        isStreaming: false,
      }));
      setIsStreaming(false);
    };

    // 2-step: fetch context from backend, then stream from CF Worker
    const streamFromWorker = async (
      contextEndpoint: string,
      bodyObj: Record<string, unknown>,
    ) => {
      try {
        // Step 1: get context from backend
        const contextRes = await fetch(`${API_URL}${contextEndpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken() || ""}`
          },
          body: JSON.stringify(bodyObj)
        });

        if (!contextRes.ok) {
          const err = await contextRes.json().catch(() => ({}));
          throw new Error(err.detail || `Context error: ${contextRes.status}`);
        }

        const { context, question: q } = await contextRes.json();

        // Step 2: stream from Cloudflare Worker
        const aiRes = await fetch(CF_WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, question: q }),
        });

        if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);

        const reader = aiRes.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") {
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
              // Non-JSON chunk
            }
          }
        }
        onDone();
      } catch (err: any) {
        onError(err.message || "Streaming failed");
      }
    };

    if (selectedSourceIds.length > 1) {
      await streamFromWorker("/chat/multi/context", { question, source_ids: selectedSourceIds });
    } else if (activeSourceObj) {
      await streamFromWorker("/chat/context", { source_identifier: activeSourceObj.source_identifier, question });
    }
  }

  function msgHasText(sId: string) {
    const msgs = useAppStore.getState().conversations[sId] || [];
    return msgs.length > 0 && msgs[msgs.length - 1].text.length > 10;
  }

  // Simulate attaching a citation for demo purposes
  async function getSourceChunksAndAttachCitation(aid: number) {
    try {
      const res = await api.getSourceChunks(aid);
      if (res.chunks && res.chunks.length > 0) {
        updateLastMessage(sourceId, (msg) => ({
          ...msg,
          citation: res.chunks[Math.floor(Math.random() * res.chunks.length)],
        }));
      }
    } catch { }
  }

  function handleClear() {
    if (isStreaming) return;
    if (!confirm("Clear this conversation?")) return;
    clearConversation(sourceId);
    toast.success("Conversation cleared");
  }

  function handleExport() {
    if (!currentUser) return;
    if (!messages.length) {
      toast.error("Nothing to export yet");
      return;
    }

    const title = isMultiSourceMode
      ? "Multi-Source Chat"
      : activeSource?.title || "Untitled";
    const lines: string[] = [`# ${title}\n\n`];

    for (const m of messages) {
      const sender = m.role === "user" ? currentUser.name : "Clariva AI";
      lines.push(`### ${sender} — ${m.time}\n${m.text}\n`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clariva-chat-${Date.now()}.md`;
    a.click();
  }

  if (!activeSource && !isMultiSourceMode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-full bg-background relative overflow-hidden"
    >
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#252535] bg-[#0e0e16] shadow-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1 lg:ml-0 ml-10"> {/* left margin for mobile toggle */}
          {isMultiSourceMode ? (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0 bg-primary/10 text-primary border border-primary/20">
              Multi-Source
            </span>
          ) : (
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-[6px] text-[11px] font-bold uppercase tracking-[0.08em] shrink-0 border",
                typeBadgeMap[type]
              )}
            >
              {getSourceTypeLabel(type)}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="font-['Playfair_Display'] text-base font-[600] text-[#f0f0ec] truncate">
              {selectedSourceIds.length > 1 ? "Knowledge Base Chat" : activeSourceObj?.title || "Untitled"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          <button
            onClick={handleClear}
            disabled={isStreaming}
            className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all disabled:opacity-40"
            title="Clear chat"
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all flex items-center gap-1.5"
            title="Export as Markdown"
          >
            <Download className="w-[18px] h-[18px]" />
          </button>

          <div className="w-[1px] h-6 bg-border mx-1" />

          <button
            onClick={() => setIsStudioOpen(!isStudioOpen)}
            className={cn(
              "p-2 rounded-md transition-all flex items-center gap-2 font-medium text-sm",
              isStudioOpen
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Toggle Notes panel"
          >
            {isStudioOpen ? <PanelRightClose className="w-[18px] h-[18px]" /> : <PanelRightOpen className="w-[18px] h-[18px]" />}
            <span className="hidden sm:inline">Notes</span>
          </button>
        </div>
      </header>

      {selectedSourceIds.length > 0 && (
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center justify-between text-xs font-medium text-primary shadow-inner">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Answering from {selectedSourceIds.length} selected source{selectedSourceIds.length > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={clearSourceSelection}
            className="hover:text-primary/70 transition-colors uppercase tracking-widest text-[10px] font-bold"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Messages Area — Centered max-w-[768px] like ChatGPT/Claude */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 min-h-0 scroll-smooth relative z-0"
      >
        <div className="max-w-[768px] mx-auto flex flex-col gap-8 pb-32">

          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mt-12 flex flex-col items-center"
            >
              {selectedSourceIds.length <= 1 && activeSourceObj && (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#0e0e16] border border-[#252535] flex items-center justify-center mb-6 text-[#6b7280]">
                    <Headphones className="w-8 h-8 opacity-50" />
                  </div>
                  <h3 className="font-['Playfair_Display'] text-[26px] mb-2 text-[#f0f0ec]">Dive into this source</h3>
                  <p className="text-[#6b7280] text-[15px] leading-[1.7] mb-10 max-w-sm">
                    Ask questions, get summaries, or open the Studio panel to generate audio overviews.
                  </p>
                  <SuggestionChips
                    type={type}
                    visible={true}
                    onSelect={(q) => {
                      setInputValue(q);
                      setTimeout(() => handleSendDirect(q), 50);
                    }}
                  />
                </>
              )}
              {selectedSourceIds.length > 1 && (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#0e0e16] border border-[#252535] flex items-center justify-center mb-6 text-[#6b7280]">
                    <Layers className="w-8 h-8" />
                  </div>
                  <h3 className="font-['Playfair_Display'] text-[26px] mb-2 text-[#f0f0ec]">Multi-Source Analysis</h3>
                  <p className="text-[#6b7280] text-[15px] leading-[1.7] max-w-sm">
                    Ask questions across all the documents, videos, and websites in your knowledge base.
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={`${sourceId}-${i}`}
                message={msg}
                messageIndex={i}
                sourceId={sourceId}
                userName={currentUser?.name || "User"}
              />
            ))
          )}
        </div>
      </div>

      {/* Input Area — Anchored at bottom inside the centered column layout */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6 px-4 sm:px-6 z-20 pointer-events-none">
        <div className="max-w-[768px] mx-auto pointer-events-auto">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isStreaming}
          />
          <div className="text-center mt-3 text-[12px] text-[#4a4a5a]">
            Clariva AI can make mistakes. Verify important information with citations.
          </div>
        </div>
      </div>
    </motion.div>
  );

  // Direct send helper for suggestion chips
  async function handleSendDirect(question: string) {
    if (!activeSourceObj || !currentUser) return;
    if (!question || question.length > 500) return;
    if (isStreaming) return;

    setInputValue("");

    addMessage(sourceId, {
      role: "user",
      text: question,
      time: formatTime(),
    });

    addMessage(sourceId, {
      role: "ai",
      text: "",
      time: formatTime(),
      isStreaming: true,
    });

    setIsStreaming(true);

    const onToken = (token: string) => {
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        text: msg.text + token,
      }));
    };

    const onDone = () => {
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        isStreaming: false,
      }));
      setIsStreaming(false);
      setTimeout(() => getSourceChunksAndAttachCitation(activeSourceObj.id), 500);
    };

    const onError = (error: string) => {
      updateLastMessage(sourceId, (msg) => ({
        ...msg,
        text: `Error: ${error}`,
        isStreaming: false,
      }));
      setIsStreaming(false);
    };

    try {
      // Step 1: get context from backend
      const contextRes = await fetch(`${API_URL}/chat/context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken() || ""}`
        },
        body: JSON.stringify({ source_identifier: activeSourceObj.source_identifier, question })
      });

      if (!contextRes.ok) {
        const errData = await contextRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Context error: ${contextRes.status}`);
      }

      const { context, question: q } = await contextRes.json();

      // Step 2: stream from Cloudflare Worker
      const aiRes = await fetch(CF_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, question: q }),
      });

      if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);

      const reader = aiRes.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const payload = trimmed.slice(6);
          if (payload === "[DONE]") {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            if (parsed.response !== undefined) {
              onToken(parsed.response);
            } else if (parsed.token !== undefined) {
              onToken(parsed.token);
            }
          } catch { }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err.message || "Streaming failed");
    }
  }
}
