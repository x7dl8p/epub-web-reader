'use client';

import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { useRouter } from 'waku/router/client';
import {
  saveBook,
  listBooks,
  deleteBook,
  updateBookMeta,
  setActiveBookId,
  getActiveBookId,
  type CachedBookMeta,
  type StoredBook,
} from '@/lib/epub-store';
import { parseEpubArchive } from '@/lib/epub-parser';
import {
  BookOpen,
  UploadCloud,
  Loader2,
  Trash2,
  Plus,
  X,
  FileText,
  Copy,
  Check,
  AlertTriangle,
  MoreVertical,
  Edit3,
} from 'lucide-react';

/** Per-file outcome shown in the upload modal while a batch is processing. */
interface FileProgress {
  name: string;
  status: 'pending' | 'parsing' | 'done' | 'failed';
  detail: string;
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function UploadZone() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [books, setBooks] = useState<StoredBook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [errorDetails, setErrorDetails] = useState<{ message: string; log: string } | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  // Per-card menu & edit modal state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState<StoredBook | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');

  const refreshLibrary = async () => {
    const stored = await listBooks();
    setBooks(stored);
    setActiveId(getActiveBookId());
  };

  useEffect(() => {
    refreshLibrary().finally(() => setIsLoadingLibrary(false));
  }, []);

  // Close any open card menu when clicking elsewhere on the page.
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  /**
   * Parses and stores an entire batch. Files are handled one at a time so a
   * 300 MB drop doesn't hold every decompressed archive in memory at once, and
   * so one corrupt file cannot abort the rest of the batch.
   */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setErrorDetails(null);
    setLoading(true);
    setFileProgress(
      files.map((file) => ({ name: file.name, status: 'pending', detail: formatSize(file.size) }))
    );

    const logMessages: string[] = [];
    const addLog = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      logMessages.push(line);
      console.log(line);
    };

    const updateProgress = (index: number, patch: Partial<FileProgress>) => {
      setFileProgress((prev) =>
        prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
      );
    };

    let succeeded = 0;
    let lastSavedId: string | null = null;
    const failures: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      updateProgress(i, { status: 'parsing', detail: 'Decompressing…' });
      addLog(`--- "${file.name}" (${formatSize(file.size)}) ---`);

      try {
        if (!file.name.toLowerCase().endsWith('.epub')) {
          throw new Error('Not a .epub archive.');
        }

        const buffer = await file.arrayBuffer();
        const { meta } = await parseEpubArchive(buffer);
        addLog(`Parsed "${meta.title}" by ${meta.creator || 'Unknown'} — ${meta.spine?.length || 0} spine items`);

        if (!meta.spine || meta.spine.length === 0) {
          throw new Error('EPUB contains no linear reading order (spine items not found).');
        }

        const id = await saveBook(buffer, meta);
        if (id) lastSavedId = id;
        addLog(`Stored in IndexedDB as ${id}`);

        succeeded++;
        updateProgress(i, {
          status: 'done',
          detail: `${meta.totalChapters} chapters`,
        });
      } catch (err: any) {
        const errorMsg = err?.message || 'Unexpected parsing error.';
        addLog(`ERROR: ${errorMsg}`);
        if (err?.stack) addLog(`STACK TRACE:\n${err.stack}`);
        failures.push(`${file.name}: ${errorMsg}`);
        updateProgress(i, { status: 'failed', detail: errorMsg });
      }
    }

    await refreshLibrary();
    setLoading(false);

    if (failures.length > 0) {
      setErrorDetails({
        message:
          succeeded > 0
            ? `${succeeded} of ${files.length} books imported. ${failures.length} failed.`
            : `Could not import ${failures.length === 1 ? 'the file' : 'any of the files'}.`,
        log: logMessages.join('\n'),
      });
      return;
    }

    // Whole batch succeeded — open the last import straight away.
    if (lastSavedId) {
      setActiveBookId(lastSavedId);
      setIsUploadOpen(false);
      router.push('/reader/0');
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
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) handleFiles(dropped);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) handleFiles(selected);
    e.target.value = '';
  };

  const handleOpenBook = (book: StoredBook) => {
    setActiveBookId(book.id);
    setActiveId(book.id);
    router.push(`/reader/${book.chapterIndex || 0}`);
  };

  const handleDeleteBook = async (book: StoredBook) => {
    setOpenMenuId(null);
    if (!confirm(`Delete "${book.meta.title}" from local storage?`)) return;
    await deleteBook(book.id);
    await refreshLibrary();
  };

  const handleSaveEditMeta = async () => {
    if (!editingBook) return;
    const updatedMeta: CachedBookMeta = {
      ...editingBook.meta,
      title: editTitle.trim() || editingBook.meta.title,
      creator: editAuthor.trim(),
    };
    await updateBookMeta(editingBook.id, updatedMeta);
    await refreshLibrary();
    setEditingBook(null);
  };

  const copyLogsToClipboard = () => {
    if (!errorDetails?.log) return;
    navigator.clipboard.writeText(errorDetails.log);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const totalBytes = books.reduce((sum, book) => sum + (book.sizeBytes || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-3 py-1">
      {/* Main Upload Button - Full Width */}
      <button
        type="button"
        onClick={() => {
          setErrorDetails(null);
          setFileProgress([]);
          setIsUploadOpen(true);
        }}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
      >
        <Plus className="w-4 h-4" />
        <span>Upload Novels</span>
      </button>

      {/* Library */}
      {isLoadingLibrary ? (
        <div className="p-4 rounded-xl border border-fd-border bg-fd-card/40 flex items-center justify-center gap-2 text-fd-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-fd-primary" />
          <span className="text-xs font-semibold text-fd-foreground">Checking local storage...</span>
        </div>
      ) : books.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-fd-muted-foreground">
              Library ({books.length} {books.length === 1 ? 'Novel' : 'Novels'})
            </h2>
            <span className="text-[10px] text-fd-muted-foreground">
              {formatSize(totalBytes)} in IndexedDB
            </span>
          </div>

          {books.map((book) => {
            const isActive = book.id === activeId;
            const progressPercent = Math.round(
              ((book.chapterIndex + 1) / (book.meta.totalChapters || 1)) * 100
            );

            return (
              <div
                key={book.id}
                onClick={() => handleOpenBook(book)}
                className={`group relative flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border bg-fd-card hover:bg-fd-accent/20 transition-all cursor-pointer shadow-2xs ${
                  isActive
                    ? 'border-fd-primary/60 ring-1 ring-fd-primary/20'
                    : 'border-fd-border hover:border-fd-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1.5 rounded-lg bg-fd-primary/10 text-fd-primary shrink-0 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-fd-foreground truncate">
                        {book.meta.title}
                      </h3>
                      {isActive && (
                        <span className="shrink-0 px-1.5 py-px rounded-full bg-fd-primary/15 text-fd-primary text-[9px] font-bold uppercase tracking-wide">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-fd-muted-foreground truncate">
                      {book.meta.creator ? `${book.meta.creator} • ` : ''}
                      {book.meta.totalChapters} Chs • Ch {book.chapterIndex + 1} ({progressPercent}%)
                      {book.sizeBytes ? ` • ${formatSize(book.sizeBytes)}` : ''}
                    </p>
                  </div>
                </div>

                {/* 3-Dot Options Button */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === book.id ? null : book.id);
                    }}
                    className="p-1.5 rounded-lg text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-colors cursor-pointer"
                    title="Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenuId === book.id && (
                    <div
                      className="absolute right-0 top-8 z-30 w-40 rounded-xl border border-fd-border bg-fd-card shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setEditingBook(book);
                          setEditTitle(book.meta.title);
                          setEditAuthor(book.meta.creator || '');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-fd-accent text-fd-foreground transition-colors cursor-pointer text-left"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-fd-primary" />
                        <span>Edit Novel Info</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBook(book)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Novel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-xl border border-dashed border-fd-border bg-fd-card/40 flex flex-col items-center justify-center text-center gap-2">
          <div className="p-2 rounded-full bg-fd-secondary text-fd-muted-foreground">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-xs text-fd-foreground">No Novels Loaded Yet</p>
            <p className="text-[11px] text-fd-muted-foreground mt-0.5">
              Click &quot;Upload Novels&quot; above to drop one or more EPUB files and begin reading.
            </p>
          </div>
        </div>
      )}

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
                  <h3 className="font-bold text-base text-fd-foreground leading-tight">
                    Upload EPUB Books
                  </h3>
                  <p className="text-xs text-fd-muted-foreground">
                    Select or drop one or more .epub files
                  </p>
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
              className={`relative group cursor-pointer flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-200 ${
                isDragging
                  ? 'border-fd-primary bg-fd-primary/5 scale-[1.01]'
                  : 'border-fd-border hover:border-fd-primary/60 bg-fd-secondary/30 hover:bg-fd-accent/20'
              } ${loading ? 'opacity-80 pointer-events-none' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".epub,application/epub+zip"
                className="hidden"
                onChange={handleInputChange}
                disabled={loading}
              />

              {loading ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-fd-primary" />
                  <p className="text-sm font-bold text-fd-foreground">
                    Importing {fileProgress.length} {fileProgress.length === 1 ? 'book' : 'books'}…
                  </p>
                  <p className="text-xs text-fd-muted-foreground max-w-xs">
                    Decompressing chapters, indexing tables of contents, and saving offline...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3.5 rounded-full bg-fd-primary/10 text-fd-primary group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-fd-foreground">
                      Drop EPUB files here, or{' '}
                      <span className="text-fd-primary underline">browse files</span>
                    </p>
                    <p className="text-xs text-fd-muted-foreground mt-1">
                      Select multiple files at once — EPUB 2 and EPUB 3 supported
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Per-file batch progress */}
            {fileProgress.length > 0 && (
              <div className="mt-4 flex flex-col gap-1 max-h-44 overflow-y-auto">
                {fileProgress.map((entry, i) => (
                  <div
                    key={`${entry.name}-${i}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-fd-secondary/50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.status === 'done' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : entry.status === 'failed' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : entry.status === 'parsing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-fd-primary shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-fd-border shrink-0" />
                      )}
                      <span className="truncate text-fd-foreground font-medium">{entry.name}</span>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] ${
                        entry.status === 'failed' ? 'text-red-500' : 'text-fd-muted-foreground'
                      }`}
                    >
                      {entry.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {errorDetails && (
              <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-500">Import Incomplete</p>
                    <p className="text-xs text-red-500/90 mt-0.5">{errorDetails.message}</p>
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
                  <h3 className="font-bold text-base text-fd-foreground leading-tight">
                    EPUB Diagnostic Logs
                  </h3>
                  <p className="text-xs text-fd-muted-foreground">
                    Error trace and environment diagnostics
                  </p>
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

      {/* Edit Novel Info Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-sm p-5 rounded-2xl border border-fd-border bg-fd-card text-fd-foreground shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-fd-border pb-2.5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-fd-primary" />
                <h3 className="font-bold text-sm text-fd-foreground">Edit Novel Info</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="p-1 rounded-lg hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Novel Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-fd-secondary border border-fd-border text-fd-foreground focus:outline-none focus:ring-1 focus:ring-fd-primary"
                  placeholder="Enter title..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Author Name
                </label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-fd-secondary border border-fd-border text-fd-foreground focus:outline-none focus:ring-1 focus:ring-fd-primary"
                  placeholder="Enter author..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-fd-border">
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="px-3 py-1.5 rounded-lg border border-fd-border text-xs font-medium hover:bg-fd-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditMeta}
                className="px-3 py-1.5 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
