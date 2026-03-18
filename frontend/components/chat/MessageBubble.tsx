"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { ThumbsUp, ThumbsDown, Pin, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  messageIndex: number;
  sourceId: string;
  userName: string;
}

export function MessageBubble({ message, messageIndex, sourceId, userName }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { activeSource, setMessageFeedback, setCitationState, setNotes, notes } = useAppStore();
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const isAiDone = !isUser && !message.isStreaming && message.text.length > 0;

  async function handleFeedback(rating: 1 | -1) {
    if (!activeSource || feedbackLoading || message.feedbackGiven) return;

    setFeedbackLoading(true);
    try {
      const msgs = useAppStore.getState().conversations[sourceId] || [];
      let question = "";
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          question = msgs[i].text;
          break;
        }
      }

      await api.sendFeedback({
        source_id: activeSource.id,
        question,
        answer: message.text,
        rating,
      });

      setMessageFeedback(sourceId, messageIndex, rating);
      toast.success("Feedback submitted");
    } catch {
      toast.error("Failed to send feedback");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function handlePin() {
    if (!activeSource || isUser) return;
    try {
      const msgs = useAppStore.getState().conversations[sourceId] || [];
      let question = "Pinned Note";
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          question = msgs[i].text;
          break;
        }
      }
      const note = await api.createNote(activeSource.id, question, message.text);
      setNotes([note, ...notes]);
      toast.success("Saved to Notes");
    } catch {
      toast.error("Failed to save note");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-4 sm:gap-6 w-full group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold font-display shadow-sm mt-0.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-background border border-border text-foreground"
        )}
      >
        {isUser ? userName.charAt(0).toUpperCase() : "AI"}
      </div>

      <div className={cn("flex flex-col max-w-[85%] min-w-0", isUser && "items-end")}>
        {/* Name Tag */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-foreground">
            {isUser ? "You" : "Clariva AI"}
          </span>
          <span className="text-[10px] text-muted-foreground">{message.time}</span>
        </div>

        {/* Message Bubble Container */}
        <div
          className={cn(
            "relative",
            isUser
              ? ""
              : "pl-4 border-l-2 border-primary/20 hover:border-primary/50 transition-colors"
          )}
        >
          {isUser ? (
            <div className="bg-secondary/70 border border-border px-5 py-3.5 rounded-2xl rounded-tr-sm text-foreground text-[15px] leading-relaxed break-words whitespace-pre-wrap">
              {message.text}
            </div>
          ) : (
            <div className="prose prose-base dark:prose-invert max-w-none break-words leading-[1.7]">
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {message.text || (message.isStreaming ? "Thinking..." : "")}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 align-middle animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Citations and Sources below message */}
        {!isUser && message.sourceTitle && (
          <div className="mt-3 flex flex-wrap gap-2 px-4 border-l-2 border-transparent">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary rounded border border-border text-[11px] text-muted-foreground font-medium">
              <FileText className="w-3 h-3" />
              {message.sourceTitle}
            </span>
          </div>
        )}

        {/* AI Action Buttons */}
        {isAiDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mt-4 px-4 border-l-2 border-transparent"
          >
            {message.citation && (
              <button
                onClick={() => setCitationState({ 
                  isOpen: true, 
                  text: message.citation!, 
                  sourceTitle: activeSource?.title || "Source" 
                })}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 mr-2"
              >
                <FileText className="w-3.5 h-3.5" />
                View Source
              </button>
            )}

            <button
              onClick={handlePin}
              className="p-1.5 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Save to Notes"
            >
              <Pin className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-border mx-1" />
            <button
              onClick={() => handleFeedback(1)}
              disabled={!!message.feedbackGiven || feedbackLoading}
              className={cn(
                "p-1.5 rounded transition-all",
                message.feedbackGiven === 1
                  ? "text-emerald-500 bg-emerald-500/10"
                  : "text-muted-foreground hover:text-emerald-500 hover:bg-secondary"
              )}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleFeedback(-1)}
              disabled={!!message.feedbackGiven || feedbackLoading}
              className={cn(
                "p-1.5 rounded transition-all",
                message.feedbackGiven === -1
                  ? "text-rose-500 bg-rose-500/10"
                  : "text-muted-foreground hover:text-rose-500 hover:bg-secondary"
              )}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
