"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Link as LinkIcon, Loader2, Plus, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";

export function IngestPanel() {
  const { currentUser, isProcessing, setIsProcessing, setSources, setActiveSource } =
    useAppStore();

  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("Processing...");
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [youtubeError, setYoutubeError] = useState<{ message: string, suggestions: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);

  async function handleProcess(retryUrl?: string) {
    if (!currentUser) return;
    const processUrl = retryUrl || url.trim();
    const file = selectedFile.current;

    if (!processUrl && !file) {
      toast.error("Enter a URL or upload a PDF/TXT");
      return;
    }

    setIsProcessing(true);
    setProgress(30);
    setYoutubeError(null);

    try {
      let result;
      if (file) {
        if (file.size > 100 * 1024 * 1024) {
          toast.warning("Large files may take several minutes to transcribe");
        }

        let msg = "Processing...";
        if (file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) {
          msg = "Transcribing audio, please wait...";
        } else if (file.name.match(/\.(mp4|mov|webm|mkv)$/i)) {
          msg = "Extracting video, please wait...";
        }
        setLoadingMessage(msg);

        if (file.name.toLowerCase().endsWith(".txt")) {
          result = await api.processTextUpload(file);
        } else if (file.name.match(/\.(mp3|wav|m4a|ogg|mp4|mov|webm|mkv)$/i)) {
          result = await api.uploadAudio(file);
        } else {
          result = await api.processPdf(file);
        }
      } else {
        setLoadingMessage("Processing...");
        result = await api.processUrl(processUrl);
      }

      setProgress(80);
      const sources = await api.getSources(currentUser.id);
      setSources(sources);
      setActiveSource(result);

      setProgress(100);
      setUrl("");
      setFileName("");
      selectedFile.current = null;
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Source processed successfully");
    } catch (err: any) {
      if (err && err.error === "youtube_blocked") {
        setYoutubeError(err);
      } else {
        toast.error(err instanceof Error ? err.message : err.message || "Processing failed");
      }
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 500);
    }
  }

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      selectedFile.current = f;
      setFileName(f.name);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    const allowedTypes = [
      "application/pdf", "text/plain",
      "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a",
      "video/mp4", "video/quicktime", "video/webm", "video/x-matroska"
    ];
    if (f && (allowedTypes.includes(f.type) || f.name.match(/\.(pdf|txt|mp3|wav|m4a|ogg|mp4|mov|webm|mkv)$/i))) {
      selectedFile.current = f;
      setFileName(f.name);
    } else if (f) {
      toast.error("Only PDF, TXT, Audio, and Video files are supported");
    }
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm relative overflow-hidden">
      {/* Progress bar background */}
      {isProcessing && (
        <div
          className="absolute inset-y-0 left-0 bg-primary/5 transition-all duration-500 ease-out z-0"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="relative z-10 flex flex-col gap-3">
        <div className="relative">
          <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleProcess()}
            placeholder="YouTube or website URL..."
            className="pl-9 h-11 bg-background border-border shadow-none rounded-xl text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center p-3 border border-dashed rounded-xl cursor-pointer text-sm font-medium transition-all col-span-2 ${isDragOver || fileName
                ? "border-primary text-primary bg-primary/5"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-secondary"
              }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm,.mkv"
              onChange={onFileChange}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>{fileName || "Upload PDF, Audio or Video"}</span>
            </div>
          </label>
        </div>

        {youtubeError && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <AlertTriangle className="h-4 w-4" />
              {youtubeError.message}
            </div>
            <ul className="list-disc pl-5 space-y-1 mb-3 text-xs opacity-90">
              {youtubeError.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => handleProcess(url)}
              >
                Try again on hotspot
              </Button>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="w-full flex flex-col overflow-hidden">
            <div className="w-full truncate text-sm text-muted-foreground px-3 py-2 rounded-lg bg-secondary border border-border text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="truncate">{loadingMessage}</span>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">
              Large files may take a few minutes
            </div>
          </div>
        ) : (
          <Button
            onClick={() => handleProcess()}
            disabled={!url && !fileName}
            variant="default"
            className="w-full h-11 rounded-xl text-sm font-semibold shadow-sm gap-2 shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Add to Knowledge Base</span>
          </Button>
        )}
      </div>
    </div>
  );
}
