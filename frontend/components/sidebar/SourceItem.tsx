"use client";

import { useState } from "react";
import { Trash2, FileText, Youtube, Globe, MoreVertical, Mic, Video, File } from "lucide-react";
import { motion } from "framer-motion";
import { cn, getSourceType } from "@/lib/utils";
import type { Source } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SourceItemProps {
  source: Source;
  isActive: boolean;
  isSelected?: boolean;
  viewMode: "grid" | "list";
  onSelect: () => void;
  onToggleSelection?: () => void;
  onDelete: () => void;
}

const typeIconMap: Record<string, React.ReactNode> = {
  yt: <Youtube className="w-5 h-5" />,
  web: <Globe className="w-5 h-5" />,
  pdf: <FileText className="w-5 h-5" />,
  audio: <Mic className="w-5 h-5" />,
  video: <Video className="w-5 h-5" />,
  text: <File className="w-5 h-5" />,
};

const typeColorMap: Record<string, string> = {
  yt: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]",
  web: "text-[#93c5fd] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)]",
  pdf: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]",
  audio: "text-[#b8aef8] bg-[rgba(124,106,245,0.1)] border border-[rgba(124,106,245,0.3)]",
  video: "text-[#b8aef8] bg-[rgba(124,106,245,0.1)] border border-[rgba(124,106,245,0.3)]",
  text: "text-[#d1d5db] bg-[rgba(107,114,128,0.1)] border border-[rgba(107,114,128,0.3)]",
};

export function SourceItem({ source, isActive, isSelected, viewMode, onSelect, onToggleSelection, onDelete }: SourceItemProps) {
  const type = getSourceType(source);
  const isGrid = viewMode === "grid";

  // Format date correctly if created_at exists
  const dateStr = (source as any).created_at
    ? new Date((source as any).created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : "Just now";

  if (isGrid) {
    return (
      <div className="relative overflow-visible group h-[130px]">
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={onSelect}
          className={cn(
            "flex flex-col p-3.5 rounded-[10px] border cursor-pointer transition-all h-full overflow-hidden select-none z-0",
            isActive
              ? "bg-[rgba(124,106,245,0.08)] border-[rgba(124,106,245,0.3)] shadow-[rgba(124,106,245,0.05)] shadow-sm"
              : isSelected
                ? "bg-[rgba(124,106,245,0.05)] border-[rgba(124,106,245,0.2)] shadow-sm"
                : "bg-[#0e0e16] border-[#252535] hover:border-[#353545] hover:bg-[#111120] hover:shadow-sm"
          )}
        >
          <div className="flex justify-between items-start mb-2 z-10 w-full relative">
            <div className="flex items-center gap-2">
              <div
                className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                onClick={(e) => { e.stopPropagation(); onToggleSelection?.(); }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className={cn("w-4 h-4 rounded border-border cursor-pointer", isSelected && "opacity-100")}
                />
              </div>
              <div className={cn("p-2 rounded-xl flex items-center justify-center shrink-0", typeColorMap[type] || typeColorMap.pdf)}>
                {typeIconMap[type] || typeIconMap.pdf}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px] p-1">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-destructive" />
                  Remove source
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-end z-10">
            <div className="text-[13px] font-[600] text-[#f0f0ec] line-clamp-2 leading-tight mb-1">
              {source.title || "Untitled Source"}
            </div>
            <div className="text-[11px] text-[#6b7280] truncate uppercase tracking-wider font-semibold">
              {dateStr}
            </div>
          </div>

          {/* Abstract background shape for visual interest */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none -z-10">
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-secondary opacity-50 group-hover:scale-110 transition-transform duration-500" />
          </div>
        </motion.div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] bg-background/80 backdrop-blur-md border border-border"
          title="Remove source"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // LIST MODE
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onSelect}
      className={cn(
        "group flex items-center justify-between p-2.5 rounded-[10px] border cursor-pointer transition-all select-none",
        isActive
          ? "bg-[rgba(124,106,245,0.08)] border-[rgba(124,106,245,0.3)] shadow-[rgba(124,106,245,0.05)] shadow-sm"
          : isSelected
            ? "bg-[rgba(124,106,245,0.05)] border-[rgba(124,106,245,0.2)] shadow-sm"
            : "bg-[#0e0e16] border-[#252535] hover:border-[#353545] hover:bg-[#111120] hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onToggleSelection?.(); }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            readOnly
            className="w-4 h-4 rounded border-border cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ opacity: isSelected ? 1 : undefined }}
          />
        </div>
        <div className={cn("p-1.5 rounded-lg flex items-center justify-center shrink-0", typeColorMap[type] || typeColorMap.pdf)}>
          {typeIconMap[type] || typeIconMap.pdf}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13px] font-[600] text-[#f0f0ec] truncate">{source.title || "Untitled"}</span>
          <span className="text-[11px] text-[#6b7280] truncate">{source.source_identifier}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Remove"
        >
          <Trash2 className="w-[14px] h-[14px]" />
        </button>
      </div>
    </motion.div>
  );
}
