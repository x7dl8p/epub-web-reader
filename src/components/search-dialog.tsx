'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'waku/router/client';
import { Search, X, BookOpen } from 'lucide-react';
import type { CachedBookMeta, ReaderPrefs } from '@/lib/epub-store';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  meta: CachedBookMeta | null;
  prefs: ReaderPrefs;
}

export function SearchDialog({ isOpen, onClose, meta, prefs }: SearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!meta || q.length < 3) return null;

    const showNumbers = prefs.showChapterNumbers !== false;
    return meta.spine
      .map((s, i) => ({
        idx: i,
        label: showNumbers
          ? `${i + 1}. ${s.label || `Chapter ${i + 1}`}`
          : s.label || `Chapter ${i + 1}`,
      }))
      .filter(({ idx, label }) => label.toLowerCase().includes(q) || String(idx + 1).includes(q));
  }, [meta, query, prefs.showChapterNumbers]);

  if (!isOpen) return null;

  const trimmed = query.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-fd-border bg-fd-card text-fd-foreground shadow-2xl overflow-hidden flex flex-col max-h-[80vh] z-10 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-fd-border bg-fd-card">
          <Search className="w-4 h-4 text-fd-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type at least 3 letters to search chapters..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-fd-foreground focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-fd-muted-foreground hover:text-fd-foreground rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-[11px] font-semibold rounded-md border border-fd-border bg-fd-secondary text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-2">
          {trimmed.length === 0 ? (
            <div className="py-8 text-center text-xs text-fd-muted-foreground">
              Type at least 3 letters to search all {meta?.totalChapters || ''} chapters...
            </div>
          ) : trimmed.length < 3 ? (
            <div className="py-8 text-center text-xs text-fd-muted-foreground">
              Type at least 3 letters to search...
            </div>
          ) : searchResults && searchResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-fd-muted-foreground">
              No chapters matching &quot;{query}&quot;
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {searchResults?.map(({ idx, label }) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    router.push(`/reader/${idx}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-fd-accent text-xs font-medium text-fd-foreground transition-colors cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className="w-3.5 h-3.5 text-fd-muted-foreground group-hover:text-fd-primary transition-colors shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-fd-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    Jump →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
