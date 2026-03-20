"use client";

import { useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  maxChars?: number;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  maxChars = 500,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const isOverLimit = value.length > maxChars;

  return (
    <div className="px-6 pb-4 pt-3 border-t border-border bg-background shrink-0">
      <div
        className={cn(
          "flex items-end gap-2.5 rounded-[12px] border border-[#252535] bg-[#0e0e16] px-4 py-2.5 transition-all",
          "focus-within:border-[rgba(124,106,245,0.5)] focus-within:shadow-[0_0_0_3px_rgba(124,106,245,0.08)]"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask anything about this source…"
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground resize-none max-h-[120px] overflow-y-auto leading-relaxed font-body"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim() || isOverLimit}
          className={cn(
            "w-9 h-9 rounded-lg bg-[#7c6af5] text-white flex items-center justify-center shrink-0 transition-all",
            "hover:bg-[#6d5ce6]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <div className="flex justify-between items-center mt-1.5 px-1">
        <span
          className={cn(
            "text-[12px]",
            isOverLimit ? "text-red-400" : "text-[#4a4a5a]"
          )}
        >
          {value.length} / {maxChars}
        </span>
        <span className="text-[12px] text-[#4a4a5a]">
          Shift+Enter for new line · Enter to send
        </span>
      </div>
    </div>
  );
}
