'use client';

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import {
  getCachedMetaSync,
  loadCachedMeta,
  loadPrefs,
  type CachedBookMeta,
  type ReaderPrefs,
} from '@/lib/epub-store';
import type { Root, Node } from 'fumadocs-core/page-tree';
import { useRouter } from 'waku/router/client';
import { BookOpen, Search, Sliders } from 'lucide-react';
import { ReaderSettingsModal } from './reader-settings';
import { SearchDialog } from './search-dialog';

export function ReaderLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [meta, setMeta] = useState<CachedBookMeta | null>(() => getCachedMetaSync());
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadCachedMeta().then((cached) => {
      if (cached) setMeta(cached);
    });
    setPrefs(loadPrefs());

    const onPrefs = (e: Event) => {
      const ev = e as CustomEvent<ReaderPrefs>;
      setPrefs(ev.detail || loadPrefs());
    };
    const onBookChange = () => {
      setMeta(getCachedMetaSync());
      loadCachedMeta().then((cached) => {
        if (cached) setMeta(cached);
      });
    };

    // Keyboard shortcut for Cmd+K / Ctrl+K
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('reader-prefs-changed', onPrefs);
    window.addEventListener('active-book-changed', onBookChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('reader-prefs-changed', onPrefs);
      window.removeEventListener('active-book-changed', onBookChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Static tree for DocsLayout
  const tree = useMemo<Root>(() => {
    if (!meta) return { name: 'Table of Contents', children: [] };

    const showNumbers = prefs.showChapterNumbers !== false;
    const fmt = (label: string, i: number) => (showNumbers ? `${i + 1}. ${label}` : label);
    const items = meta.spine;

    if (items.length > 60) {
      const BATCH = 50;
      const folders: Node[] = [];
      for (let i = 0; i < items.length; i += BATCH) {
        const end = Math.min(i + BATCH, items.length);
        folders.push({
          type: 'folder',
          name: `Chapters ${i + 1} – ${end}`,
          children: Array.from({ length: end - i }, (_, k) => ({
            type: 'page' as const,
            name: fmt(items[i + k]?.label || `Chapter ${i + k + 1}`, i + k),
            url: `/reader/${i + k}`,
          })),
        });
      }
      return { name: 'Table of Contents', children: folders };
    }

    return {
      name: 'Table of Contents',
      children: items.map((s, i) => ({
        type: 'page' as const,
        name: fmt(s.label || `Chapter ${i + 1}`, i),
        url: `/reader/${i}`,
      })),
    };
  }, [meta, prefs.showChapterNumbers]);

  const options = baseOptions();
  const customizedOptions = {
    ...options,
    disableSearch: true,
    nav: {
      ...options.nav,
      title: (
        <div
          onClick={() => router.push('/')}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity min-w-0 max-w-[170px] sm:max-w-[200px] overflow-hidden"
          title={meta?.title || 'Novel Reader'}
        >
          <BookOpen className="w-4 h-4 text-fd-foreground shrink-0" />
          <span className="truncate text-sm font-bold text-fd-foreground overflow-hidden text-ellipsis whitespace-nowrap block min-w-0">
            {meta?.title || 'Novel Reader'}
          </span>
        </div>
      ),
      children: (
        <div className="ms-auto flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsSettingsOpen(true);
            }}
            className="p-1.5 rounded-xl hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer flex items-center justify-center border border-fd-border bg-fd-card/90 shadow-2xs shrink-0"
            title="Typography & Reader Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      ),
    },
    links: [
      {
        type: 'icon' as const,
        text: 'Reader Settings',
        icon: (
          <span
            onClick={(e) => {
              e.preventDefault();
              setIsSettingsOpen(true);
            }}
            className="flex items-center justify-center p-1 hover:text-fd-foreground text-fd-muted-foreground transition-colors cursor-pointer"
            title="Reader Settings"
          >
            <Sliders className="w-4 h-4" />
          </span>
        ),
        url: '#',
        active: 'none' as const,
      },
    ],
  };

  return (
    <>
      <DocsLayout
        key={meta?.title || 'layout'}
        {...customizedOptions}
        tree={tree}
        sidebar={{
          defaultOpenLevel: 1,
          banner: (
            <div className="pb-2 border-b border-fd-border">
              {/* Fumadocs Search Popup Dialog Trigger */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-fd-border bg-fd-secondary/80 hover:bg-fd-accent text-xs text-fd-muted-foreground hover:text-fd-foreground transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-fd-muted-foreground group-hover:text-fd-foreground transition-colors" />
                  <span>Search (min 3 letters)...</span>
                </div>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border border-fd-border bg-fd-card text-fd-muted-foreground">
                  ⌘K
                </kbd>
              </button>

              {meta?.totalChapters && (
                <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-fd-muted-foreground">
                  <span>{meta.totalChapters} chapters</span>
                  {meta.creator && (
                    <span className="truncate max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {meta.creator}
                    </span>
                  )}
                </div>
              )}
            </div>
          ),
        }}
      >
        {children}
      </DocsLayout>

      {/* Reader Settings Drawer */}
      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Fumadocs-style Search Popup Modal */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        meta={meta}
        prefs={prefs}
      />
    </>
  );
}
