"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SourceType } from "@/lib/types";

interface SuggestionChipsProps {
  type: SourceType;
  visible: boolean;
  onSelect: (question: string) => void;
}

const SUGGESTIONS: Record<SourceType, string[]> = {
  yt: [
    "Summarise this video",
    "What are the key takeaways?",
    "List all topics covered",
    "Who is the speaker?",
  ],
  web: [
    "What is this page about?",
    "Bullet-point the main ideas",
    "Are there any statistics?",
    "What are the conclusions?",
  ],
  pdf: [
    "Give me an overview",
    "Extract the key arguments",
    "List all action items",
    "Summarise each section",
  ],
  audio: [
    "Summarise this audio",
    "What are the key takeaways?",
    "Who is speaking?",
    "Transcribe the main points",
  ],
  video: [
    "Summarise this video",
    "List all topics covered",
    "What are the conclusions?",
    "Who is the speaker?",
  ],
  text: [
    "Summarise this document",
    "Bullet-point the main ideas",
    "Extract the key arguments",
    "List all action items",
  ],
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const chip = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};

export function SuggestionChips({ type, visible, onSelect }: SuggestionChipsProps) {
  if (!visible) return null;

  const questions = SUGGESTIONS[type] || SUGGESTIONS.web;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-wrap gap-2 px-6 pt-3 shrink-0"
    >
      {questions.map((q) => (
        <motion.button
          key={q}
          variants={chip}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(q)}
          className={cn(
            "px-3 py-[5px] border border-input rounded-full text-xs text-muted-foreground",
            "cursor-pointer transition-colors",
            "hover:border-primary hover:text-cogni-accent-2 hover:bg-cogni-accent-glow",
            "bg-card"
          )}
        >
          {q}
        </motion.button>
      ))}
    </motion.div>
  );
}
