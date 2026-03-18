"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, Layers, Command, LayoutGrid, List, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { api, getAccessToken } from "@/lib/api";
import { IngestPanel } from "@/components/sidebar/IngestPanel";
import { SourceSearch } from "@/components/sidebar/SourceSearch";
import { SourceItem } from "@/components/sidebar/SourceItem";
import { CommandPalette } from "@/components/CommandPalette";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { CitationDrawer } from "@/components/chat/CitationDrawer";

function BrandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="5" fill="currentColor" />
      <line x1="14" y1="1" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="21" x2="14" y2="27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="14" x2="7" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="14" x2="27" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const {
    currentUser, logout, allSources, setSources, activeSource,
    setActiveSource, searchQuery, isMultiSourceMode, setIsMultiSourceMode, setCommandPaletteOpen,
    viewMode, setViewMode, isStudioOpen, setIsStudioOpen, setNotes,
    selectedSourceIds, setSelectedSourceIds, clearSourceSelection, toggleSourceSelection
  } = useAppStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (!currentUser || !getAccessToken()) {
      router.replace("/");
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;

    api.getSources(currentUser.id)
      .then((s) => setSources(s))
      .catch(() => toast.error("Could not load sources"));

    api.getNotes()
      .then((n) => setNotes(n))
      .catch(() => console.error("Could not load notes"));
  }, [currentUser, setSources, setNotes]);

  const filteredSources = useMemo(() => {
    if (!searchQuery) return allSources;
    const q = searchQuery.toLowerCase();
    return allSources.filter(
      (s) => (s.title || "").toLowerCase().includes(q) || s.source_identifier.toLowerCase().includes(q)
    );
  }, [allSources, searchQuery]);

  async function handleLogout() {
    await api.logout();
    logout();
    toast("Signed out");
    router.replace("/");
  }

  async function handleDelete(id: number) {
    if (!currentUser) return;
    if (!confirm("Remove this source from your knowledge base?")) return;
    try {
      await api.deleteSource(id);
      const refreshed = await api.getSources(currentUser.id);
      setSources(refreshed);
      if (activeSource?.id === id) setActiveSource(null);
      toast.success("Source removed");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen bg-background text-foreground">
        <div className="w-[320px] bg-card border-r border-border p-5 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-[120px] w-full rounded-xl" />))}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CommandPalette />

      {/* Left Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 h-screen bg-cogni-surface-2 border-r border-border flex flex-col overflow-hidden shadow-sm"
          >
            <div className="w-[340px] flex flex-col h-full overflow-hidden p-0">
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-4 bg-card border-b border-border">
                <div className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <span className="text-primary"><BrandIcon /></span>
                  <span className="tracking-tight">Clariva</span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setCommandPaletteOpen(true)} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Search sources (Ctrl+K)">
                    <Command className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1.5 ml-1 bg-secondary border border-border rounded-full pl-0.5 pr-2.5 py-0.5 text-xs text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-semibold font-display shrink-0">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{currentUser.name.split(" ")[0]}</span>
                    <button onClick={handleLogout} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
                      <LogOut className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 pt-5 pb-2">
                <IngestPanel />
              </div>

              <div className="flex-1 flex flex-col min-h-0 px-5">
                <div className="flex items-center justify-between mb-3 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Sources</span>
                    <span className="bg-secondary border border-border rounded-full px-2 py-px text-[11px] font-display font-semibold text-muted-foreground">{allSources.length}</span>
                  </div>
                  <div className="flex border border-border rounded-lg overflow-hidden bg-card">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 ${viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 border-l border-border ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <SourceSearch />

                {allSources.length > 1 && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      if (selectedSourceIds.length === allSources.length) {
                        clearSourceSelection();
                      } else {
                        setSelectedSourceIds(allSources.map(s => s.id));
                      }
                    }}
                    className={`flex items-center gap-2 w-full px-4 py-2.5 mt-3 mb-2 rounded-xl border text-sm font-medium transition-all shadow-sm ${selectedSourceIds.length === allSources.length
                      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      : "bg-card border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                      }`}
                  >
                    <Layers className="h-[18px] w-[18px] shrink-0" />
                    <span>Chat with all sources</span>
                  </motion.button>
                )}

                <ScrollArea className="flex-1 mt-2 -mx-2 px-2">
                  <AnimatePresence mode="popLayout">
                    {filteredSources.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="w-12 h-12 rounded-full bg-secondary text-muted-foreground mx-auto flex items-center justify-center mb-3">
                          <Layers className="w-6 h-6 opacity-50" />
                        </div>
                        <p className="text-foreground text-sm font-medium mb-1">No sources yet</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">Add a URL or PDF above to start building your knowledge base.</p>
                      </div>
                    ) : (
                      <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3 pb-6 text-left" : "flex flex-col gap-2 pb-6"}>
                        {filteredSources.map((source) => (
                          <SourceItem
                            key={source.id}
                            source={source}
                            isActive={activeSource?.id === source.id}
                            isSelected={selectedSourceIds.includes(source.id)}
                            viewMode={viewMode}
                            onSelect={() => { setActiveSource(source); setIsMultiSourceMode(false); }}
                            onToggleSelection={() => toggleSourceSelection(source.id)}
                            onDelete={() => handleDelete(source.id)}
                          />
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </ScrollArea>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative z-10">
        {/* Toggle generic sidebar on mobile/desktop */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg shadow-sm text-muted-foreground hover:text-foreground transition-all lg:hidden"
        >
          {isSidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </button>

        {children}

        {/* Global Citation Drawer Layer */}
        <CitationDrawer />
      </main>

      {/* Right Sidebar (Studio / Notes) */}
      <AnimatePresence>
        {isStudioOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 h-screen border-l border-border bg-cogni-surface-2 overflow-hidden shadow-sm z-20"
          >
            <div className="w-[340px] h-full flex flex-col">
              <NotesPanel />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
