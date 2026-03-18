"use client";

// app/dashboard/page.tsx — Dashboard page with multi-source mode support and welcome screen

import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { ChatWindow } from "@/components/chat/ChatWindow";

function BrandOrb() {
  return (
    <svg width="56" height="56" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1" />
      <circle cx="14" cy="14" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="14" cy="14" r="2" fill="currentColor" />
      <line x1="14" y1="1" x2="14" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="14" y1="21" x2="14" y2="27" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="1" y1="14" x2="7" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="21" y1="14" x2="27" y2="14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

const exampleChips = [
  '"Summarise this video for me"',
  '"What are the key arguments?"',
  '"Extract all action items"',
];

export default function DashboardPage() {
  const activeSource = useAppStore((s) => s.activeSource);
  const isMultiSourceMode = useAppStore((s) => s.isMultiSourceMode);

  if (activeSource || isMultiSourceMode) {
    return <ChatWindow />;
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-[460px] px-10"
      >
        <div className="w-[72px] h-[72px] mx-auto mb-7 flex items-center justify-center rounded-full bg-secondary border border-input text-cogni-accent-2 animate-pulse-orb">
          <BrandOrb />
        </div>

        <h2 className="font-display text-[26px] font-bold text-foreground mb-3 tracking-tight">
          What would you like to explore?
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Select a source from your knowledge base to begin, or add a new one
          using the panel on the left.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          {exampleChips.map((chip) => (
            <span
              key={chip}
              className="px-3.5 py-[7px] bg-secondary border border-input rounded-full text-xs text-muted-foreground italic cursor-default hover:bg-cogni-accent-glow hover:border-primary hover:text-cogni-accent-2 transition-all"
            >
              {chip}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
