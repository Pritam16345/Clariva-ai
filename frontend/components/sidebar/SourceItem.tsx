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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col p-[12px_14px] rounded-[12px] border cursor-pointer transition-all duration-[0.15s] ease-in-out select-none",
        isActive
          ? "bg-[rgba(124,106,245,0.07)] border-[rgba(124,106,245,0.45)] shadow-sm"
          : isSelected
            ? "bg-[rgba(124,106,245,0.05)] border-[rgba(124,106,245,0.2)] shadow-sm"
            : "bg-[#0e0e16] border-[#252535] hover:border-[#353545] hover:bg-[#111120] hover:shadow-sm"
      )}
    >
      <div className="flex items-center justify-between mb-[8px] min-w-0">
        <div className="flex items-center gap-[8px]">
          <div
            className="flex items-center justify-center shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleSelection?.(); }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="w-4 h-4 rounded border-[#252535] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ opacity: isSelected ? 1 : undefined }}
            />
          </div>
          <span className={cn("inline-flex items-center font-[700] text-[10px] tracking-[0.08em] px-[8px] py-[3px] rounded-[4px] uppercase", typeColorMap[type] || typeColorMap.pdf)}>
            {type.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="text-[13px] font-[600] text-[#f0f0ec] leading-[1.4] line-clamp-2 text-wrap mb-[4px]">
        {source.title || "Untitled"}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] text-[#6b7280] truncate max-w-[70%]">{source.source_identifier}</span>
        <span className="text-[11px] text-[#4a4a5a] shrink-0">{dateStr}</span>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-[10px] right-[10px] opacity-0 group-hover:opacity-100 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[6px] p-[4px_6px] text-[#fca5a5] text-[12px] transition-opacity"
        title="Remove source"
      >
        <Trash2 className="w-[14px] h-[14px]" />
      </button>
    </motion.div>
  );
}
