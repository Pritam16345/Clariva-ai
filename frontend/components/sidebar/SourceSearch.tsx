"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";

export function SourceSearch() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#4a4a5a] pointer-events-none" />
      <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search sources…"
        className="pl-8 h-8 text-[13px] bg-[#0e0e16] border border-[#252535] text-[#f0f0ec] placeholder:text-[#4a4a5a] rounded-lg focus-visible:ring-0 focus:border-[rgba(124,106,245,0.4)]"
      />
    </div>
  );
}
