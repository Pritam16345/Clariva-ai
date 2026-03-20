"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Trash2, Download, Pin, PinOff, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getSourceType, getSourceTypeLabel } from "@/lib/utils";
import type { Note, Source } from "@/lib/types";

const typeBadgeMap: Record<string, string> = {
  yt: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]",
  web: "text-[#93c5fd] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)]",
  pdf: "text-[#fca5a5] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)]",
  audio: "text-[#b8aef8] bg-[rgba(124,106,245,0.12)] border border-[rgba(124,106,245,0.35)]",
  video: "text-[#b8aef8] bg-[rgba(124,106,245,0.1)] border border-[rgba(124,106,245,0.3)]",
  text: "text-[#d1d5db] bg-[rgba(107,114,128,0.1)] border border-[rgba(107,114,128,0.3)]",
};

export function NotesPanel() {
  const { notes, setNotes, allSources } = useAppStore();
  const [pinnedNoteIds, setPinnedNoteIds] = useState<Set<number>>(new Set());

  const togglePin = (id: number) => {
    setPinnedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteNote(id);
      setNotes(notes.filter((n) => n.id !== id));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const handleExport = () => {
    if (!notes.length) {
      toast.info("No notes to export");
      return;
    }
    const text = notes
      .map((n) => `# [${n.source_title}]\n**Q:** ${n.question}\n**A:** ${n.answer}\n---\n`)
      .join("\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clariva-notes.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pinnedNotes = notes.filter((n) => pinnedNoteIds.has(n.id));
  const unpinnedNotes = notes.filter((n) => !pinnedNoteIds.has(n.id));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-l border-[#252535] select-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#252535] bg-[#0e0e16]">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Saved Notes
        </h3>
        <button
          onClick={handleExport}
          className="text-muted-foreground hover:text-primary transition-colors p-1"
          title="Export to Markdown"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 p-5">
        <AnimatePresence>
          {notes.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10 text-sm">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
              Pin messages directly from the chat to save them here.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {pinnedNotes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
                    <Pin className="w-3.5 h-3.5" /> Pinned
                  </h4>
                  <div className="space-y-4">
                    {pinnedNotes.map((note) => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        isPinned={true}
                        sources={allSources}
                        onTogglePin={() => togglePin(note.id)} 
                        onDelete={() => handleDelete(note.id)} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {unpinnedNotes.length > 0 && (
                <div className="space-y-3">
                  {pinnedNotes.length > 0 && (
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px bg-border flex-1" />
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</h4>
                      <div className="h-px bg-border flex-1" />
                    </div>
                  )}
                  <div className="space-y-4">
                    {unpinnedNotes.map((note) => (
                      <NoteCard 
                        key={note.id} 
                        note={note} 
                        isPinned={false}
                        sources={allSources}
                        onTogglePin={() => togglePin(note.id)} 
                        onDelete={() => handleDelete(note.id)} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

function NoteCard({ 
  note, 
  isPinned,
  sources, 
  onTogglePin, 
  onDelete 
}: { 
  note: Note; 
  isPinned: boolean;
  sources: Source[]; 
  onTogglePin: () => void; 
  onDelete: () => void; 
}) {
  const [expanded, setExpanded] = useState(false);
  
  const sourceObj = sources.find(s => s.id === note.source_id);
  const type = sourceObj ? getSourceType(sourceObj) : "web";
  const badgeClass = typeBadgeMap[type] || "text-foreground bg-secondary";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative bg-[#0e0e16] border border-[#252535] hover:border-[rgba(124,106,245,0.3)] p-4 rounded-[10px] shadow-sm hover:shadow-md transition-shadow group text-left cursor-text"
    >
      <div className="flex justify-between items-start mb-3 gap-2">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md truncate max-w-[70%]", badgeClass)}>
          {note.source_title}
        </span>
        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={cn(
              "p-1.5 rounded-md transition-all",
              isPinned ? "text-primary bg-primary/10" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-secondary"
            )}
            title={isPinned ? "Unpin note" : "Pin note"}
          >
            {isPinned ? <PinOff className="w-[14px] h-[14px]" /> : <Pin className="w-[14px] h-[14px]" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete note"
          >
            <Trash2 className="w-[14px] h-[14px]" />
          </button>
        </div>
      </div>
      
      <p className="text-[13px] font-[600] text-[#f0f0ec] mb-2 leading-snug break-words">
        {note.question}
      </p>
      
      <div className="relative">
        <p className={cn(
          "text-[12px] text-[#6b7280] leading-[1.6] break-words whitespace-pre-wrap",
          !expanded && "line-clamp-3"
        )}>
          {note.answer}
        </p>
        
        {note.answer.length > 150 && (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-2 text-[11px] font-semibold text-primary/80 hover:text-primary flex items-center gap-1 transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show more <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
