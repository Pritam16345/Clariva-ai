// store/useAppStore.ts — Zustand store with JWT auth, streaming state, multi-source mode, and feedback tracking

import { create } from "zustand";
import type { Conversations, Message, Source, User, Note } from "@/lib/types";

interface AppState {
  /* Auth */
  currentUser: User | null;
  setUser: (user: User) => void;
  logout: () => void;

  /* Sources */
  allSources: Source[];
  activeSource: Source | null;
  selectedSourceIds: number[];
  setSources: (sources: Source[]) => void;
  setActiveSource: (source: Source | null) => void;
  setSelectedSourceIds: (ids: number[]) => void;
  toggleSourceSelection: (id: number) => void;
  clearSourceSelection: () => void;

  /* Conversations */
  conversations: Conversations;
  addMessage: (sourceId: string, msg: Message) => void;
  updateLastMessage: (sourceId: string, updater: (msg: Message) => Message) => void;
  setMessageFeedback: (sourceId: string, messageIndex: number, rating: 1 | -1) => void;
  clearConversation: (sourceId: string) => void;

  /* UI */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  isChatLoading: boolean;
  setIsChatLoading: (v: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  isMultiSourceMode: boolean;
  setIsMultiSourceMode: (v: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;

  /* Notes & Studio */
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  isStudioOpen: boolean;
  setIsStudioOpen: (v: boolean) => void;
  citationState: { isOpen: boolean; text: string; sourceTitle: string };
  setCitationState: (state: { isOpen: boolean; text: string; sourceTitle: string }) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
}

export const useAppStore = create<AppState>()((set) => ({
  /* Auth — JWT tokens stored in api.ts module, user object here */
  currentUser: null,
  setUser: (user) => {
    set({ currentUser: user });
  },
  logout: () => {
    set({
      currentUser: null,
      allSources: [],
      activeSource: null,
      conversations: {},
      isMultiSourceMode: false,
    });
  },

  /* Sources */
  allSources: [],
  activeSource: null,
  selectedSourceIds: [],
  setSources: (sources) => set({ allSources: sources }),
  setActiveSource: (source) => set({ activeSource: source, isMultiSourceMode: false }),
  setSelectedSourceIds: (ids) => set({ selectedSourceIds: ids, isMultiSourceMode: ids.length > 0 }),
  toggleSourceSelection: (id) =>
    set((state) => {
      const selected = state.selectedSourceIds.includes(id)
        ? state.selectedSourceIds.filter((sid) => sid !== id)
        : [...state.selectedSourceIds, id];
      return {
        selectedSourceIds: selected,
        isMultiSourceMode: selected.length > 0,
      };
    }),
  clearSourceSelection: () => set({ selectedSourceIds: [], isMultiSourceMode: false }),

  /* Conversations */
  conversations: {},
  addMessage: (sourceId, msg) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [sourceId]: [...(state.conversations[sourceId] || []), msg],
      },
    })),
  updateLastMessage: (sourceId, updater) =>
    set((state) => {
      const msgs = state.conversations[sourceId] || [];
      if (msgs.length === 0) return state;
      const updated = [...msgs];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return {
        conversations: { ...state.conversations, [sourceId]: updated },
      };
    }),
  setMessageFeedback: (sourceId, messageIndex, rating) =>
    set((state) => {
      const msgs = state.conversations[sourceId] || [];
      if (messageIndex < 0 || messageIndex >= msgs.length) return state;
      const updated = [...msgs];
      updated[messageIndex] = { ...updated[messageIndex], feedbackGiven: rating };
      return {
        conversations: { ...state.conversations, [sourceId]: updated },
      };
    }),
  clearConversation: (sourceId) =>
    set((state) => ({
      conversations: { ...state.conversations, [sourceId]: [] },
    })),

  /* UI */
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  isProcessing: false,
  setIsProcessing: (v) => set({ isProcessing: v }),
  isChatLoading: false,
  setIsChatLoading: (v) => set({ isChatLoading: v }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),
  isMultiSourceMode: false,
  setIsMultiSourceMode: (v) => set({ isMultiSourceMode: v }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),

  /* Notes & Studio */
  notes: [],
  setNotes: (notes) => set({ notes }),
  isStudioOpen: false,
  setIsStudioOpen: (v) => set({ isStudioOpen: v }),
  citationState: { isOpen: false, text: "", sourceTitle: "" },
  setCitationState: (state) => set({ citationState: state }),
  viewMode: "list",
  setViewMode: (mode) => set({ viewMode: mode }),
}));
