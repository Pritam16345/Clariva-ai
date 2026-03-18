"use client";

// CommandPalette.tsx — Full-screen command palette (Cmd+K / Ctrl+K) using cmdk library

import { useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, Globe, Play, Mic, Video, File } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getSourceType } from "@/lib/utils";
import type { Source } from "@/lib/types";

const typeIconMap = {
  yt: Play,
  web: Globe,
  pdf: FileText,
  audio: Mic,
  video: Video,
  text: File,
} as const;

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    allSources,
    setActiveSource,
    setIsMultiSourceMode,
  } = useAppStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    },
    [commandPaletteOpen, setCommandPaletteOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function handleSelect(source: Source) {
    setActiveSource(source);
    setIsMultiSourceMode(false);
    setCommandPaletteOpen(false);
  }

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          >
            <Command
              className="w-full max-w-[520px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              label="Search sources"
            >
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Command.Input
                  placeholder="Search your knowledge base..."
                  className="flex-1 h-12 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-mono shrink-0">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No sources found.
                </Command.Empty>

                <Command.Group heading="Sources" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                  {allSources.map((source) => {
                    const type = getSourceType(source);
                    const Icon = typeIconMap[type];
                    return (
                      <Command.Item
                        key={source.id}
                        value={`${source.title || ""} ${source.source_identifier}`}
                        onSelect={() => handleSelect(source)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-foreground transition-colors data-[selected=true]:bg-secondary data-[selected=true]:text-foreground"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {source.title || "Untitled"}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {source.source_identifier}
                          </div>
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </Command.List>

              <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted border border-border rounded px-1 py-px font-mono text-[10px]">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted border border-border rounded px-1 py-px font-mono text-[10px]">↵</kbd>
                  Select
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
