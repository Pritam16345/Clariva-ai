import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Source, SourceType } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSourceType(source: Source): SourceType {
  const id = (source.source_identifier || "").toLowerCase();
  
  if (source.source_type === "audio") return "audio";
  if (source.source_type === "video") return "video";

  if (
    source.source_type === "youtube" ||
    id.includes("youtube") ||
    id.includes("youtu.be")
  )
    return "yt";
  if (source.source_type === "pdf" || id.endsWith(".pdf")) return "pdf";
  if (source.source_type === "text" || id.endsWith(".txt")) return "text";
  
  return "web";
}

export function getSourceTypeLabel(type: SourceType): string {
  switch (type) {
    case "yt":
      return "YT";
    case "pdf":
      return "PDF";
    case "audio":
      return "AUDIO";
    case "video":
      return "VIDEO";
    case "text":
      return "TXT";
    case "web":
    default:
      return "WEB";
  }
}

export function formatTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
