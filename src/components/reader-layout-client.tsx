'use client';

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { getCachedMetaSync, loadCachedMeta, loadPrefs, type CachedBookMeta, type ReaderPrefs } from '@/lib/epub-store';
import type { Root, Node } from 'fumadocs-core/page-tree';
import { useRouter } from 'waku/router/client';
import { BookOpen, Search, Sliders } from 'lucide-react';
import { ReaderSettingsModal } from './reader-settings';

export function ReaderLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Seed from the in-memory cache so a client-side navigation (which remounts this
  // layout) paints the chapter list on the first frame instead of flashing empty
  // while IndexedDB is re-read asynchronously.
  const [meta, setMeta] = useState<CachedBookMeta | null>(() => getCachedMetaSync());
  const [searchQuery, setSearchQuery] = useState('');
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const cached = await loadCachedMeta();
      if (cached) {
        setMeta(cached);
      }
      setPrefs(loadPrefs());
    }
    load();

    const handlePrefsChange = (e: Event) => {
      const customEvent = e as CustomEvent<ReaderPrefs>;
      if (customEvent.detail) {
        setPrefs(customEvent.detail);
      } else {
        setPrefs(loadPrefs());
      }
    };

    // Switching books in the library must swap the chapter list under the reader.
    const handleActiveBookChange = () => {
      setMeta(getCachedMetaSync());
      loadCachedMeta().then((cached) => {
        if (cached) setMeta(cached);
      });
    };

    window.addEventListener('reader-prefs-changed', handlePrefsChange);
    window.addEventListener('active-book-changed', handleActiveBookChange);
    return () => {
      window.removeEventListener('reader-prefs-changed', handlePrefsChange);
      window.removeEventListener('active-book-changed', handleActiveBookChange);
    };
  }, []);

  // Build Fumadocs Page Tree dynamically
  const tree = useMemo<Root>(() => {
    if (!meta) {
      return {
        name: 'Table of Contents',
        children: [],
      };
    }

    const items =
      meta.toc && meta.toc.length > 0
        ? meta.toc
        : meta.spine.map((s, i) => ({
          id: s.id || String(i),
          label: s.label || `Chapter ${i + 1}`,
          href: s.href,
        }));

    const showNumbers = prefs.showChapterNumbers !== false;
    const formatName = (label: string, idx: number) => {
      return showNumbers ? `${idx + 1}. ${label}` : label;
    };

    const query = searchQuery.trim().toLowerCase();

    // If searching, return filtered flat list
    if (query) {
      const filtered: Node[] = [];
      items.forEach((item, idx) => {
        const label = item.label || `Chapter ${idx + 1}`;
        if (label.toLowerCase().includes(query) || String(idx + 1).includes(query)) {
          filtered.push({
            type: 'page',
            name: formatName(label, idx),
            url: `/reader/${idx}`,
          });
        }
      });
      return {
        name: 'Table of Contents',
        children: filtered,
      };
    }

    // For books with > 60 chapters, group them into batches of 50 for smooth sidebar scrolling
    if (items.length > 60) {
      const BATCH_SIZE = 50;
      const folders: Node[] = [];

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, items.length);
        const childrenNodes: Node[] = [];

        for (let j = i; j < batchEnd; j++) {
          const item = items[j];
          if (item) {
            const label = item.label || `Chapter ${j + 1}`;
            childrenNodes.push({
              type: 'page',
              name: formatName(label, j),
              url: `/reader/${j}`,
            });
          }
        }

        folders.push({
          type: 'folder',
          name: `Chapters ${i + 1} – ${batchEnd}`,
          children: childrenNodes,
        });
      }

      return {
        name: 'Table of Contents',
        children: folders,
      };
    }

    // Normal flat list for small books
    const pageNodes: Node[] = items.map((item, index) => ({
      type: 'page',
      name: formatName(item.label || `Chapter ${index + 1}`, index),
      url: `/reader/${index}`,
    }));

    return {
      name: 'Table of Contents',
      children: pageNodes,
    };
  }, [meta, searchQuery, prefs.showChapterNumbers]);

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
        {...customizedOptions}
        tree={tree}
        sidebar={{
          defaultOpenLevel: 1,
          banner: (
            <div className="pt-1 pb-2 border-b border-fd-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fd-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${meta?.totalChapters || ''} chapters...`}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-fd-secondary placeholder:text-fd-muted-foreground focus:outline-none focus:ring-1 focus:ring-fd-primary"
                />
              </div>

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

      {/* Reader Settings Slide-over Drawer */}
      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
