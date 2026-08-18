'use client';

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'waku/router/client';
import {
  getActiveBookId,
  loadBookBuffer,
  loadCachedMeta,
  loadPrefs,
  saveProgress,
  DEFAULT_PREFS,
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

/** Vertical space kept free below the column viewport for the pager bar. */
const PAGER_RESERVE_PX = 76;
/** Never collapse the viewport below this, however cramped the window is. */
const MIN_VIEWPORT_PX = 240;

export function ChapterView({ chapterParam }: { chapterParam: string }) {
  const router = useRouter();
  const rawIndex = parseInt(chapterParam, 10);
  const chapterIndex = isNaN(rawIndex) ? 0 : Math.max(0, rawIndex);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ExtractedChapter | null>(null);
  const [meta, setMeta] = useState<CachedBookMeta | null>(null);
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);

  // --- Paginated (two-page) mode state ---
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  // When paging backwards into a chapter we must land on its final spread, but the
  // page count isn't known until after that chapter has been laid out.
  const landOnLastPageRef = useRef(false);

  const paginated = prefs.twoPageMode;

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

  /**
   * Sizes the column viewport to the remaining screen height, then works out how many
   * screen-wide spreads the chapter overflows into. Columns are laid out with
   * `column-fill: auto` at a fixed height, so extra content flows off to the right
   * instead of downwards — paging is then just a horizontal translate.
   */
  const measurePages = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    // Fit the viewport to whatever space is left below it, so the page never scrolls.
    // `top` already accounts for the top margin; the bottom margin has to come off
    // explicitly since nothing below the viewport reserves it.
    const top = viewport.getBoundingClientRect().top;
    const available = window.innerHeight - top - PAGER_RESERVE_PX - prefs.marginY;
    viewport.style.height = `${Math.max(MIN_VIEWPORT_PX, available)}px`;

    const gap = parseFloat(getComputedStyle(content).columnGap || '0') || 0;
    const spread = viewport.clientWidth + gap;
    if (spread <= 0) return;

    // scrollWidth omits the trailing gap, so add it back before dividing.
    const count = Math.max(1, Math.round((content.scrollWidth + gap) / spread));

    setPageWidth(spread);
    setTotalPages(count);
    setPage((current) => {
      if (landOnLastPageRef.current) {
        landOnLastPageRef.current = false;
        return count - 1;
      }
      return Math.min(current, count - 1);
    });
  }, [prefs.marginY]);

  // Re-measure whenever layout inputs change: new chapter, typography tweak, resize,
  // late-loading webfonts, or images that only get their height once decoded.
  useLayoutEffect(() => {
    if (!paginated || !chapter) return;

    measurePages();

    const observer = new ResizeObserver(measurePages);
    if (viewportRef.current) observer.observe(viewportRef.current);

    const settleTimer = setTimeout(measurePages, 150);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measurePages).catch(() => {});
    }

    const images = Array.from(contentRef.current?.querySelectorAll('img') || []);
    for (const img of images) {
      if (!img.complete) img.addEventListener('load', measurePages, { once: true });
    }

    return () => {
      observer.disconnect();
      clearTimeout(settleTimer);
      for (const img of images) img.removeEventListener('load', measurePages);
    };
  }, [paginated, chapter, prefs, measurePages]);

  // Leaving paginated mode must release the inline height we forced onto the viewport.
  useEffect(() => {
    if (!paginated && viewportRef.current) {
      viewportRef.current.style.height = '';
    }
  }, [paginated]);

  // Load Chapter Effect
  useEffect(() => {
    let isCancelled = false;

    async function loadCurrentChapter() {
      setLoading(true);
      setError(null);

      try {
        const bookId = getActiveBookId();
        if (!bookId) {
          if (!isCancelled) {
            setError('No book loaded in local storage. Please upload an EPUB first.');
            setLoading(false);
          }
          return;
        }

        let { zip, meta: activeMeta, bookId: sessionBookId } = getActiveSession();

        // Restore from IndexedDB when there is no session yet, or when the session
        // belongs to a different book than the one now selected in the library.
        if (!zip || !activeMeta || sessionBookId !== bookId) {
          const cachedMeta = await loadCachedMeta(bookId);
          const buffer = await loadBookBuffer(bookId);

          if (!buffer || !cachedMeta) {
            if (!isCancelled) {
              setError('This book is no longer in local storage. Please upload it again.');
              setLoading(false);
            }
            return;
          }

          zip = await JSZip.loadAsync(buffer);
          activeMeta = cachedMeta;
          setActiveSession(zip, activeMeta, bookId);
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
          saveProgress(bookId, safeIndex);
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

  const totalChapterCount = meta?.totalChapters || meta?.spine.length || 0;

  /** Next spread, rolling over into the next chapter at the end. */
  const goNextPage = useCallback(() => {
    setPage((current) => {
      if (current < totalPages - 1) return current + 1;
      if (chapterIndex < totalChapterCount - 1) navigateToChapter(chapterIndex + 1);
      return current;
    });
  }, [totalPages, chapterIndex, totalChapterCount, navigateToChapter]);

  /** Previous spread, rolling back into the end of the previous chapter. */
  const goPrevPage = useCallback(() => {
    setPage((current) => {
      if (current > 0) return current - 1;
      if (chapterIndex > 0) {
        landOnLastPageRef.current = true;
        navigateToChapter(chapterIndex - 1);
      }
      return current;
    });
  }, [chapterIndex, navigateToChapter]);

  // Reset to the first spread on every chapter change (unless we arrived backwards).
  useEffect(() => {
    if (!landOnLastPageRef.current) setPage(0);
  }, [chapterIndex]);

  // Keyboard navigation. In paginated mode the arrows move by page and fall through
  // to the neighbouring chapter at the edges; in scroll mode they change chapter.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!meta) return;

      if (paginated) {
        switch (e.key) {
          case 'ArrowRight':
          case 'PageDown':
            e.preventDefault();
            goNextPage();
            return;
          case 'ArrowLeft':
          case 'PageUp':
            e.preventDefault();
            goPrevPage();
            return;
          case ' ':
            e.preventDefault();
            e.shiftKey ? goPrevPage() : goNextPage();
            return;
          case 'Home':
            e.preventDefault();
            setPage(0);
            return;
          case 'End':
            e.preventDefault();
            setPage(totalPages - 1);
            return;
        }
      }

      if (e.key === 'ArrowLeft' && chapterIndex > 0) {
        navigateToChapter(chapterIndex - 1);
      } else if (e.key === 'ArrowRight' && chapterIndex < totalChapterCount - 1) {
        navigateToChapter(chapterIndex + 1);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    chapterIndex,
    meta,
    navigateToChapter,
    paginated,
    goNextPage,
    goPrevPage,
    totalPages,
    totalChapterCount,
  ]);

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

  // In paginated mode the page margins define the text box, so no max-width cap is
  // applied — otherwise margin 0 would still sit centred instead of edge to edge.
  const maxWidthStyle = paginated
    ? 'max-w-none'
    : {
        narrow: 'max-w-xl',
        normal: 'max-w-2xl',
        wide: 'max-w-3xl',
        full: 'max-w-none',
      }[prefs.maxWidth];

  const fontFamilyStyle = {
    serif: 'font-serif font-epub-serif',
    sans: 'font-sans',
    mono: 'font-mono text-[0.95em]',
    dyslexic: 'font-dyslexic',
  }[prefs.fontFamily];

  const fontWeightStyle = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    bold: 'font-bold',
  }[prefs.fontWeight || 'normal'];

  const totalChapters = meta?.totalChapters || meta?.spine.length || 0;
  const progressPercent =
    totalChapters > 0 ? Math.round(((chapterIndex + 1) / totalChapters) * 100) : 0;

  const displayTitle =
    chapter?.title || (loading ? 'Loading chapter...' : `Chapter ${chapterIndex + 1}`);

  return (
    <DocsPage breadcrumb={{ enabled: false }} footer={{ enabled: false }} tableOfContent={{ enabled: false }}>
      {/* Uncontrollable Top Header with Default Margin */}
      <div className="w-full px-4 sm:px-6 pt-3 pb-2 flex flex-col gap-1.5 shrink-0">
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
      </div>

      <div
        className={`flex flex-col gap-1.5 mx-auto w-full transition-all duration-200 ${maxWidthStyle} ${
          paginated ? 'pb-0' : 'pb-8'
        }`}
      >
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
        ) : paginated ? (
          /* Paginated spreads: fixed-height column viewport, translated horizontally.
             Margins live on this outer wrapper rather than on the viewport itself, so
             the viewport's clientWidth stays the true column box that paging measures
             against. At margin 0 the text runs edge to edge. */
          <div
            className="w-full"
            style={{ paddingLeft: prefs.marginX, paddingRight: prefs.marginX, paddingTop: prefs.marginY }}
          >
            <div
              ref={viewportRef}
              className="relative overflow-hidden w-full"
              onClick={(e) => {
                // Tap the outer thirds to turn pages, the way most e-readers behave.
                const bounds = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - bounds.left) / bounds.width;
                if (ratio < 0.33) goPrevPage();
                else if (ratio > 0.67) goNextPage();
              }}
            >
              <div
                ref={contentRef}
                className={`epub-content epub-paginated h-full ${fontSizeStyle} ${lineHeightStyle} ${letterSpacingStyle} ${fontWeightStyle} ${textAlignStyle} ${fontFamilyStyle} ${
                  prefs.indent ? 'indent-enabled' : 'indent-disabled'
                }`}
                style={{
                  transform: `translateX(-${page * pageWidth}px)`,
                  transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                dangerouslySetInnerHTML={{ __html: chapter?.html || '' }}
              />
            </div>
          </div>
        ) : (
          <DocsBody className="mt-1">
            <div
              className={`epub-content transition-all duration-150 ${fontSizeStyle} ${lineHeightStyle} ${letterSpacingStyle} ${fontWeightStyle} ${textAlignStyle} ${fontFamilyStyle} ${
                prefs.indent ? 'indent-enabled' : 'indent-disabled'
              }`}
              style={{ paddingLeft: prefs.marginX, paddingRight: prefs.marginX, paddingBlock: prefs.marginY }}
              dangerouslySetInnerHTML={{ __html: chapter?.html || '' }}
            />
          </DocsBody>
        )}

        {/* Pager: page-level navigation for paginated mode */}
        {!loading && !error && paginated && (
          <div className="flex items-center justify-between gap-3 border-t border-fd-border pt-2 mt-2">
            <button
              type="button"
              onClick={goPrevPage}
              disabled={page <= 0 && chapterIndex <= 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-fd-border text-xs font-semibold hover:bg-fd-accent disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer shadow-xs"
              title="Previous page (Left arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{page <= 0 ? 'Prev Chapter' : 'Prev Page'}</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-fd-muted-foreground font-medium tabular-nums">
              <span className="font-bold text-fd-foreground">{page + 1}</span>
              <span>/</span>
              <span>{totalPages}</span>
            </div>

            <button
              type="button"
              onClick={goNextPage}
              disabled={page >= totalPages - 1 && chapterIndex >= totalChapters - 1}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer shadow-xs"
              title="Next page (Right arrow / Space)"
            >
              <span className="hidden sm:inline">
                {page >= totalPages - 1 ? 'Next Chapter' : 'Next Page'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chapter-level navigation footer (scroll mode only) */}
        {!loading && !error && !paginated && totalChapters > 0 && (
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

