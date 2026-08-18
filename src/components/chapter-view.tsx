'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'waku/router/client';
import {
  loadBookBuffer,
  loadCachedMeta,
  loadPrefs,
  savePrefs,
  type ReaderPrefs,
  type CachedBookMeta,
} from '@/lib/epub-store';
import {
  loadChapterByIndex,
  getActiveSession,
  setActiveSession,
  type ExtractedChapter,
} from '@/lib/epub-parser';
import { DocsPage, DocsBody } from 'fumadocs-ui/layouts/docs/page';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import JSZip from 'jszip';

export function ChapterView({ chapterParam }: { chapterParam: string }) {
  const router = useRouter();
  const rawIndex = parseInt(chapterParam, 10);
  const chapterIndex = isNaN(rawIndex) ? 0 : Math.max(0, rawIndex);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ExtractedChapter | null>(null);
  const [meta, setMeta] = useState<CachedBookMeta | null>(null);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS_CLIENT);

  useEffect(() => {
    setPrefs(loadPrefs());

    const handlePrefsChange = (e: Event) => {
      const customEvent = e as CustomEvent<ReaderPrefs>;
      if (customEvent.detail) {
        setPrefs(customEvent.detail);
      } else {
        setPrefs(loadPrefs());
      }
    };

    window.addEventListener('reader-prefs-changed', handlePrefsChange);
    return () => {
      window.removeEventListener('reader-prefs-changed', handlePrefsChange);
    };
  }, []);

  const navigateToChapter = useCallback(
    (index: number) => {
      router.push(`/reader/${index}`);
    },
    [router]
  );

  // Load Chapter Effect
  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentChapter() {
      setLoading(true);
      setError(null);

      try {
        let { zip, meta: activeMeta } = getActiveSession();

        // Restore from IndexedDB if needed
        if (!zip || !activeMeta) {
          const cachedMeta = await loadCachedMeta();
          const buffer = await loadBookBuffer();

          if (!buffer || !cachedMeta) {
            if (!isCancelled) {
              setError('No book loaded in local storage. Please upload an EPUB first.');
              setLoading(false);
            }
            return;
          }

          zip = await JSZip.loadAsync(buffer);
          activeMeta = cachedMeta;
          setActiveSession(zip, activeMeta);
        }

        if (isCancelled) return;
        setMeta(activeMeta);

        const total = activeMeta.totalChapters || activeMeta.spine.length;
        const safeIndex = Math.max(0, Math.min(chapterIndex, total - 1));

        // Lazy load ONLY current chapter
        const extracted = await loadChapterByIndex(safeIndex, zip, activeMeta);

        if (!isCancelled) {
          setChapter(extracted);
          setLoading(false);
          savePrefs({ chapterIndex: safeIndex });
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      } catch (err: any) {
        console.error('[ChapterView] Error loading chapter:', err);
        if (!isCancelled) {
          setError(err?.message || 'Failed to load chapter content.');
          setLoading(false);
        }
      }
    }

    loadCurrentChapter();

    return () => {
      isCancelled = true;
    };
  }, [chapterIndex]);

  // Keyboard navigation: Left/Right arrows
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (!meta) return;
      const total = meta.totalChapters || meta.spine.length;

      if (e.key === 'ArrowLeft' && chapterIndex > 0) {
        navigateToChapter(chapterIndex - 1);
      } else if (e.key === 'ArrowRight' && chapterIndex < total - 1) {
        navigateToChapter(chapterIndex + 1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chapterIndex, meta, navigateToChapter]);

  const fontSizeStyle = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
    '2xl': 'text-2xl sm:text-3xl',
  }[prefs.fontSize];

  const lineHeightStyle = {
    tight: 'leading-snug space-y-3',
    normal: 'leading-normal space-y-4',
    relaxed: 'leading-relaxed space-y-5',
    loose: 'leading-loose space-y-6',
  }[prefs.lineHeight];

  const letterSpacingStyle = {
    tight: 'tracking-tight',
    normal: 'tracking-normal',
    wide: 'tracking-wide',
    wider: 'tracking-wider',
  }[prefs.letterSpacing];

  const textAlignStyle = {
    left: 'text-left',
    justify: 'text-justify [hyphens:auto]',
    center: 'text-center',
  }[prefs.textAlign];

  const maxWidthStyle = {
    narrow: 'max-w-xl',
    normal: 'max-w-2xl',
    wide: 'max-w-3xl',
    full: 'max-w-5xl',
  }[prefs.maxWidth];

  const fontFamilyStyle = {
    serif: 'font-serif font-epub-serif',
    sans: 'font-sans',
    mono: 'font-mono text-[0.95em]',
    dyslexic: 'font-dyslexic',
  }[prefs.fontFamily];

  const totalChapters = meta?.totalChapters || meta?.spine.length || 0;
  const progressPercent =
    totalChapters > 0 ? Math.round(((chapterIndex + 1) / totalChapters) * 100) : 0;

  const displayTitle =
    chapter?.title || (loading ? 'Loading chapter...' : `Chapter ${chapterIndex + 1}`);

  return (
    <DocsPage footer={{ enabled: false }} tableOfContent={{ enabled: false }}>
      <div className={`flex flex-col gap-1.5 pb-8 mx-auto w-full transition-all duration-200 ${maxWidthStyle}`}>
        {/* Clean Header: Title & Chapter Progress */}
        <div className="flex items-center justify-between gap-3 border-b border-fd-border pb-1.5 pt-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/')}
              title="Back to Upload & Home"
              className="p-1.5 rounded-xl text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 truncate">
              <span className="text-[10px] font-bold text-fd-primary uppercase tracking-wider block">
                Chapter {chapterIndex + 1} of {totalChapters || '...'} ({progressPercent}%)
              </span>
              <h1
                title={displayTitle}
                className="text-base sm:text-lg font-bold tracking-tight text-fd-foreground truncate overflow-hidden text-ellipsis whitespace-nowrap block mb-0 max-w-full"
              >
                {displayTitle}
              </h1>
            </div>
          </div>
        </div>

        {/* Reading Progress Line */}
        <div className="w-full bg-fd-secondary h-1 rounded-full overflow-hidden">
          <div
            className="bg-fd-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-fd-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-fd-primary" />
            <p className="text-sm font-semibold text-fd-foreground">Rendering chapter...</p>
            <p className="text-xs text-fd-muted-foreground">Extracting text & formatting layout</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
            <div className="p-3 rounded-full bg-red-100/80 text-fd-error">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-sm text-fd-error max-w-md font-medium">{error}</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-fd-primary text-fd-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              Back to Home / Upload
            </button>
          </div>
        ) : (
          <DocsBody className="mt-1">
            <div
              className={`epub-content transition-all duration-150 ${fontSizeStyle} ${lineHeightStyle} ${letterSpacingStyle} ${textAlignStyle} ${fontFamilyStyle} ${
                prefs.indent ? 'indent-enabled' : 'indent-disabled'
              }`}
              dangerouslySetInnerHTML={{ __html: chapter?.html || '' }}
            />
          </DocsBody>
        )}

        {/* Single Navigation Footer: Prev / Next */}
        {!loading && !error && totalChapters > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-fd-border pt-8 mt-12">
            <button
              type="button"
              disabled={chapterIndex <= 0}
              onClick={() => navigateToChapter(chapterIndex - 1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-fd-border text-xs font-semibold hover:bg-fd-accent disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Chapter</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-fd-muted-foreground font-medium">
              <span>Use Left / Right arrow keys</span>
            </div>

            <button
              type="button"
              disabled={chapterIndex >= totalChapters - 1}
              onClick={() => navigateToChapter(chapterIndex + 1)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
            >
              <span>Next Chapter</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </DocsPage>
  );
}

const DEFAULT_PREFS_CLIENT: ReaderPrefs = {
  chapterIndex: 0,
  fontSize: 'md',
  fontFamily: 'serif',
  lineHeight: 'relaxed',
  letterSpacing: 'normal',
  textAlign: 'left',
  maxWidth: 'normal',
  indent: true,
  showChapterNumbers: true,
  bgColor: '',
  textColor: '',
};
