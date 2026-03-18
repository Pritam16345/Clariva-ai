import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Quote, ExternalLink } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CitationDrawer() {
  const { citationState, setCitationState } = useAppStore();
  const { isOpen, text, sourceTitle } = citationState;
  
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setCitationState({ ...citationState, isOpen: false });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setCitationState, citationState]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
          {/* Overlay to dim above content slightly */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/20 backdrop-blur-[2px] z-40"
            onClick={() => setCitationState({ ...citationState, isOpen: false })}
          />
          
          {/* The drawer itself */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative z-50 bg-card border-t border-border rounded-t-3xl h-[40vh] max-h-[400px] min-h-[250px] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-cogni-surface/50 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                  <Quote className="w-5 h-5 fill-current opacity-20" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground text-lg leading-none mb-1">Source Citation</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{sourceTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setCitationState({ ...citationState, isOpen: false })}
                className="p-2 bg-secondary hover:bg-muted text-muted-foreground rounded-full transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content area */}
            <ScrollArea className="flex-1 p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none pb-4">
                <p className="text-foreground text-base leading-relaxed border-l-4 border-primary/40 pl-5 py-1">
                  {text}
                </p>
              </div>
            </ScrollArea>
            
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
