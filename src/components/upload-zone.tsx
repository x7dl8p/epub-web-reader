'use client';

import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { useRouter } from 'waku/router/client';
import {
  saveBook,
  hasSavedBook,
  loadCachedMeta,
  loadPrefs,
  clearBook,
  type CachedBookMeta,
} from '@/lib/epub-store';
import { parseEpubArchive } from '@/lib/epub-parser';
import {
  BookOpen,
  UploadCloud,
  ArrowRight,
  Loader2,
  Sparkles,
  Trash2,
  BookmarkCheck,
  Zap,
  Plus,
  X,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export function UploadZone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedBook, setSavedBook] = useState<{
    meta: CachedBookMeta;
    chapterIndex: number;
  } | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; log: string } | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  useEffect(() => {
    async function checkSaved() {
      const exists = await hasSavedBook();
      if (exists) {
        const meta = await loadCachedMeta();
        if (meta) {
          const prefs = loadPrefs();
          setSavedBook({
            meta,
            chapterIndex: prefs.chapterIndex || 0,
          });
        }
      }
    }
    checkSaved();
  }, []);

  const handleFileProcess = async (fileOrBuffer: File | ArrayBuffer) => {
    setErrorDetails(null);
    setLoading(true);
    setLoadingStep('Reading EPUB archive bytes...');

    const logMessages: string[] = [];
    const addLog = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      logMessages.push(line);
      console.log(line);
    };

    try {
      let buffer: ArrayBuffer;
      let filename = 'Uploaded Book';
      let fileSizeMb = '0';

      if (fileOrBuffer instanceof File) {
        filename = fileOrBuffer.name;
        fileSizeMb = (fileOrBuffer.size / (1024 * 1024)).toFixed(2);
        addLog(`Selected file: "${filename}" (${fileSizeMb} MB)`);

        if (!filename.toLowerCase().endsWith('.epub')) {
          throw new Error('Invalid file format. Please upload a valid .epub archive.');
        }
        buffer = await fileOrBuffer.arrayBuffer();
      } else {
        buffer = fileOrBuffer;
        addLog(`Received buffer payload`);
      }

      setLoadingStep('Decompressing archive & reading container.xml...');
      addLog(`Calling parseEpubArchive()...`);
      const { meta } = await parseEpubArchive(buffer);

      addLog(`Extracted metadata: title="${meta.title}", author="${meta.creator || 'Unknown'}"`);
      addLog(`Spine count: ${meta.spine?.length || 0}, TOC count: ${meta.toc?.length || 0}`);

      if (!meta.spine || meta.spine.length === 0) {
        throw new Error('EPUB contains no linear reading order (spine items not found).');
      }

      setLoadingStep(`Saving "${meta.title}" to local IndexedDB storage...`);
      addLog(`Writing book buffer and metadata to IndexedDB...`);
      await saveBook(buffer, meta);
      addLog(`Successfully stored in IndexedDB.`);

      setLoadingStep('Navigating to reader...');
      addLog(`Redirecting to /reader/0`);
      router.push('/reader/0');
    } catch (err: any) {
      console.error('[UploadZone Error]:', err);
      const errorMsg = err?.message || 'An unexpected error occurred while parsing the EPUB file.';
      addLog(`ERROR: ${errorMsg}`);
      if (err?.stack) addLog(`STACK TRACE:\n${err.stack}`);

      setErrorDetails({
        message: errorMsg,
        log: logMessages.join('\n'),
      });
      setLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleClearSaved = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this book from local storage?')) {
      await clearBook();
      setSavedBook(null);
    }
  };

  const copyLogsToClipboard = () => {
    if (!errorDetails?.log) return;
    navigator.clipboard.writeText(errorDetails.log);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 py-1">
      {/* Top CRM Header Strip - Ultra Compact */}
      <div className="flex flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl border border-fd-border bg-fd-card/90 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-fd-primary/10 text-fd-primary shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-fd-foreground truncate">
                Novel Reader Dashboard
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Engine Ready
              </span>
            </div>
            <p className="text-[11px] text-fd-muted-foreground truncate hidden sm:block">
              Client-side EPUB parser • Offline IndexedDB • Instant TOC
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorDetails(null);
            setIsUploadOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload New Novel</span>
        </button>
      </div>

      {/* CRM Strip: Active Stored Book */}
      {savedBook ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-fd-muted-foreground">
              Stored Novels (1 Active)
            </h2>
            <span className="text-[10px] text-fd-muted-foreground">Persisted in IndexedDB</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-fd-border bg-fd-card hover:border-fd-primary/40 transition-all shadow-xs">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-fd-primary/10 text-fd-primary shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className="font-bold text-sm text-fd-foreground truncate max-w-lg">
                    {savedBook.meta.title}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Cached
                  </span>
                </div>
                <p className="text-[11px] text-fd-muted-foreground truncate">
                  {savedBook.meta.creator ? `Author: ${savedBook.meta.creator} • ` : ''}
                  Chapters: {savedBook.meta.totalChapters} • Progress: Ch {savedBook.chapterIndex + 1} ({Math.round(((savedBook.chapterIndex + 1) / (savedBook.meta.totalChapters || 1)) * 100)}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto justify-end">
              <button
                type="button"
                onClick={handleClearSaved}
                title="Delete from offline storage"
                className="p-1.5 rounded-lg border border-fd-border hover:border-red-500/50 hover:bg-red-500/10 text-fd-muted-foreground hover:text-red-500 transition-colors cursor-pointer text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium text-[11px]">Remove</span>
              </button>
              <button
                type="button"
                onClick={() => router.push(`/reader/${savedBook.chapterIndex}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                <span>Continue Reading</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl border border-dashed border-fd-border bg-fd-card/40 flex flex-col items-center justify-center text-center gap-2">
          <div className="p-2 rounded-full bg-fd-secondary text-fd-muted-foreground">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-xs text-fd-foreground">No Novel Loaded Yet</p>
            <p className="text-[11px] text-fd-muted-foreground mt-0.5">
              Click &quot;Upload New Novel&quot; above to drop an EPUB file and begin reading.
            </p>
          </div>
        </div>
      )}

      {/* CRM System Architecture Strips */}

      {/* Upload Modal Popup */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-lg p-6 rounded-3xl border border-fd-border bg-fd-card text-fd-foreground shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-fd-border pb-3.5 mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-fd-foreground leading-tight">Upload EPUB Book</h3>
                  <p className="text-xs text-fd-muted-foreground">Select or drop a .epub file to start</p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsUploadOpen(false)}
                className="p-2 rounded-xl hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`relative group cursor-pointer flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-200 ${isDragging
                  ? 'border-fd-primary bg-fd-primary/5 scale-[1.01]'
                  : 'border-fd-border hover:border-fd-primary/60 bg-fd-secondary/30 hover:bg-fd-accent/20'
                } ${loading ? 'opacity-80 pointer-events-none' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub,application/epub+zip"
                className="hidden"
                onChange={handleInputChange}
                disabled={loading}
              />

              {loading ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-fd-primary" />
                  <p className="text-sm font-bold text-fd-foreground">{loadingStep}</p>
                  <p className="text-xs text-fd-muted-foreground max-w-xs">
                    Decompressing chapters, indexing table of contents, and saving offline...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3.5 rounded-full bg-fd-primary/10 text-fd-primary group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-fd-foreground">
                      Drop EPUB file here, or <span className="text-fd-primary underline">browse files</span>
                    </p>
                    <p className="text-xs text-fd-muted-foreground mt-1">
                      Accepts standard .epub files (EPUB 2 / EPUB 3)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message & Logs Button */}
            {errorDetails && (
              <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">Parsing Failed</p>
                    <p className="text-xs text-red-600/90 dark:text-red-400/90 mt-0.5">
                      {errorDetails.message}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLogsOpen(true)}
                  className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-[11px] font-bold hover:bg-red-600 transition-colors cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Error Logs & Debug</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Logs Modal / Page */}
      {isLogsOpen && errorDetails && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-2xl p-6 rounded-3xl border border-fd-border bg-fd-card text-fd-foreground shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-fd-border pb-3.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-fd-foreground leading-tight">EPUB Diagnostic Logs</h3>
                  <p className="text-xs text-fd-muted-foreground">Error trace and environment diagnostics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLogsOpen(false)}
                className="p-2 rounded-xl hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log Terminal Viewer */}
            <div className="flex-1 overflow-y-auto my-2 p-3.5 rounded-2xl bg-neutral-950 text-neutral-200 font-mono text-xs border border-neutral-800 leading-relaxed select-text whitespace-pre-wrap max-h-96">
              {errorDetails.log}
            </div>

            {/* Footer with Copy Button */}
            <div className="mt-3 pt-3 border-t border-fd-border flex items-center justify-between">
              <span className="text-xs text-fd-muted-foreground">
                Copy logs to share or debug issues
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyLogsToClipboard}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-fd-secondary hover:bg-fd-accent text-fd-secondary-foreground text-xs font-bold transition-colors cursor-pointer"
                >
                  {copiedLog ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Error Log</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
