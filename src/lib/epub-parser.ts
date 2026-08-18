import JSZip, { type JSZipObject } from 'jszip';
import type { CachedBookMeta, SpineItem, TocItem } from './epub-store';

export interface ExtractedChapter {
  title: string;
  html: string;
  isMarkdown: boolean;
}

// In-memory LRU cache for chapters and image object URLs
class ChapterMemoryCache {
  private cache = new Map<number, ExtractedChapter>();
  private maxChapters = 10;
  private objectUrls = new Set<string>();

  get(index: number): ExtractedChapter | undefined {
    const item = this.cache.get(index);
    if (item) {
      this.cache.delete(index);
      this.cache.set(index, item);
      console.log(`%c[EPUB Cache]%c Hit for Chapter #${index + 1}`, 'color: #10b981; font-weight: bold', 'color: inherit');
    }
    return item;
  }

  set(index: number, chapter: ExtractedChapter) {
    if (this.cache.size >= this.maxChapters) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(index, chapter);
  }

  trackUrl(url: string) {
    this.objectUrls.add(url);
  }

  clear() {
    this.cache.clear();
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.objectUrls.clear();
  }
}

// Global active reader session
let activeZip: JSZip | null = null;
let activeMeta: CachedBookMeta | null = null;
const memoryCache = new ChapterMemoryCache();

export async function parseEpubArchive(buffer: ArrayBuffer): Promise<{
  meta: CachedBookMeta;
  zip: JSZip;
}> {
  const startTime = performance.now();
  console.log(
    `%c[EPUB Parser]%c Starting archive unpack (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB)...`,
    'color: #3b82f6; font-weight: bold',
    'color: inherit'
  );

  const zip = await JSZip.loadAsync(buffer);
  const zipTime = performance.now();
  console.log(
    `%c[EPUB Parser]%c ZIP archive uncompressed in ${(zipTime - startTime).toFixed(1)}ms. Total files: ${Object.keys(zip.files).length}`,
    'color: #3b82f6; font-weight: bold',
    'color: inherit'
  );

  // 1. Find rootfile from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  let opfPath = 'OEBPS/content.opf';
  if (containerXml) {
    const match = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (match && match[1]) {
      opfPath = match[1];
    }
  }

  if (!zip.file(opfPath)) {
    const foundOpf = Object.keys(zip.files).find((p) => p.toLowerCase().endsWith('.opf'));
    if (foundOpf) {
      opfPath = foundOpf;
    }
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('Invalid EPUB: Package manifest (.opf) not found in archive.');
  }

  const opfText = await opfFile.async('text');

  // 2. Parse Title & Creator metadata
  const titleMatch = opfText.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const title = titleMatch && titleMatch[1] ? cleanText(titleMatch[1]) : 'Untitled Novel';

  const creatorMatch = opfText.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
  const creator = creatorMatch && creatorMatch[1] ? cleanText(creatorMatch[1]) : undefined;

  console.log(`%c[EPUB Parser]%c Found book: "${title}" by ${creator || 'Unknown'}`, 'color: #3b82f6; font-weight: bold', 'color: inherit');

  // 3. Parse Manifest items
  const manifest = new Map<string, { href: string; rawHref: string; mediaType: string }>();
  const itemRegex = /<item\s+([^>]+)\/?>/gi;
  let itemMatch: RegExpExecArray | null;
  let coverHref: string | null = null;

  while ((itemMatch = itemRegex.exec(opfText)) !== null) {
    const attrs = itemMatch[1] || '';
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const mediaTypeMatch = attrs.match(/media-type=["']([^"']+)["']/i);
    const propertiesMatch = attrs.match(/properties=["']([^"']+)["']/i);

    if (idMatch && idMatch[1] && hrefMatch && hrefMatch[1]) {
      const id = idMatch[1];
      const rawHref = decodeURIComponent(hrefMatch[1]);
      const normalizedHref = normalizePath(opfDir + rawHref);
      const mediaType = mediaTypeMatch && mediaTypeMatch[1] ? mediaTypeMatch[1].toLowerCase() : '';

      manifest.set(id, {
        href: normalizedHref,
        rawHref,
        mediaType,
      });

      if (
        id.toLowerCase().includes('cover') ||
        (propertiesMatch && propertiesMatch[1] && propertiesMatch[1].includes('cover-image'))
      ) {
        coverHref = normalizedHref;
      }
    }
  }

  // Extract cover image data URL if available
  let coverDataUrl: string | undefined = undefined;
  if (coverHref) {
    const coverFile = zip.file(coverHref) || zip.file(coverHref.replace(/^\//, ''));
    if (coverFile) {
      try {
        const coverBase64 = await coverFile.async('base64');
        const ext = coverHref.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        coverDataUrl = `data:${mime};base64,${coverBase64}`;
      } catch {}
    }
  }

  // 4. Parse Spine (linear reading order)
  const spine: SpineItem[] = [];
  const spineRegex = /<itemref\s+([^>]+)\/?>/gi;
  let spineMatch: RegExpExecArray | null;

  while ((spineMatch = spineRegex.exec(opfText)) !== null) {
    const itemAttrs = spineMatch[1] || '';
    const idrefMatch = itemAttrs.match(/idref=["']([^"']+)["']/i);
    if (idrefMatch && idrefMatch[1]) {
      const item = manifest.get(idrefMatch[1]);
      if (item) {
        spine.push({
          id: idrefMatch[1],
          href: item.href,
          rawHref: item.rawHref,
          mediaType: item.mediaType,
        });
      }
    }
  }

  // 5. Parse Table of Contents (NCX or NAV)
  let toc: TocItem[] = [];

  const ncxItem = Array.from(manifest.values()).find(
    (item) => item.mediaType === 'application/x-dtbncx+xml' || item.href.endsWith('.ncx')
  );

  if (ncxItem) {
    const ncxFile = zip.file(ncxItem.href) || zip.file(ncxItem.href.replace(/^\//, ''));
    if (ncxFile) {
      const ncxText = await ncxFile.async('text');
      toc = parseNcxToc(ncxText, opfDir);
      console.log(`%c[EPUB Parser]%c Loaded NCX TOC with ${toc.length} items`, 'color: #3b82f6; font-weight: bold', 'color: inherit');
    }
  }

  if (toc.length === 0) {
    const navItem = Array.from(manifest.values()).find(
      (item) => item.href.includes('nav') && (item.href.endsWith('.xhtml') || item.href.endsWith('.html'))
    );
    if (navItem) {
      const navFile = zip.file(navItem.href) || zip.file(navItem.href.replace(/^\//, ''));
      if (navFile) {
        const navText = await navFile.async('text');
        toc = parseNavToc(navText, opfDir);
        console.log(`%c[EPUB Parser]%c Loaded Nav XHTML TOC with ${toc.length} items`, 'color: #3b82f6; font-weight: bold', 'color: inherit');
      }
    }
  }

  if (toc.length === 0) {
    toc = spine.map((s, idx) => ({
      id: s.id || String(idx),
      label: `Chapter ${idx + 1}`,
      href: s.href,
    }));
  }

  // Map TOC labels to spine items
  for (const t of toc) {
    const targetPath = (t.href || '').split('#')[0] || '';
    if (targetPath) {
      const spineEntry = spine.find((s) => s.href === targetPath || s.href.endsWith(targetPath));
      if (spineEntry && !spineEntry.label) {
        spineEntry.label = t.label;
      }
    }
  }

  const meta: CachedBookMeta = {
    title,
    creator,
    coverDataUrl,
    opfDir,
    spine,
    toc,
    totalChapters: spine.length > 0 ? spine.length : toc.length,
  };

  const totalTime = performance.now() - startTime;
  console.log(
    `%c[EPUB Parser]%c Done! Parsed ${meta.totalChapters} chapters in ${totalTime.toFixed(1)}ms.`,
    'color: #10b981; font-weight: bold',
    'color: inherit'
  );

  activeZip = zip;
  activeMeta = meta;
  memoryCache.clear();

  return { meta, zip };
}

export function setActiveSession(zip: JSZip, meta: CachedBookMeta) {
  activeZip = zip;
  activeMeta = meta;
}

export function getActiveSession(): { zip: JSZip | null; meta: CachedBookMeta | null } {
  return { zip: activeZip, meta: activeMeta };
}

export async function loadChapterByIndex(
  index: number,
  zipInstance?: JSZip,
  metaInstance?: CachedBookMeta
): Promise<ExtractedChapter> {
  const start = performance.now();

  const cached = memoryCache.get(index);
  if (cached) {
    return cached;
  }

  const zip = zipInstance || activeZip;
  const meta = metaInstance || activeMeta;

  if (!zip || !meta) {
    throw new Error('EPUB reader session not initialized. Please load the book.');
  }

  const targetItem = meta.spine[index] || meta.toc[index];
  if (!targetItem) {
    throw new Error(`Chapter ${index + 1} not found in book index.`);
  }

  const rawPath = (targetItem.href || '').split('#')[0] || '';
  const possiblePaths = [
    rawPath,
    rawPath.replace(/^\//, ''),
    meta.opfDir + rawPath,
    meta.opfDir + rawPath.replace(/^\//, ''),
  ].filter(Boolean);

  let file: JSZipObject | null = null;
  for (const p of possiblePaths) {
    const found = zip.file(p);
    if (found) {
      file = found;
      break;
    }
  }

  if (!file && rawPath) {
    const fileName = rawPath.split('/').pop();
    if (fileName) {
      const matchKey = Object.keys(zip.files).find((k) => k.endsWith('/' + fileName) || k === fileName);
      if (matchKey) {
        file = zip.file(matchKey) || null;
      }
    }
  }

  if (!file) {
    console.warn(`[EPUB Parser] Chapter file not found at path: ${rawPath}`);
    return {
      title: targetItem.label || `Chapter ${index + 1}`,
      html: `<div class="p-6 rounded-xl border border-fd-border text-center text-fd-muted-foreground"><p class="font-medium">Chapter content not found at path: ${rawPath}</p></div>`,
      isMarkdown: false,
    };
  }

  const rawContent = await file.async('text');
  const isMarkdown = rawPath.toLowerCase().endsWith('.md');
  const chapterDir = rawPath.includes('/') ? rawPath.substring(0, rawPath.lastIndexOf('/') + 1) : '';

  let htmlContent = '';
  if (isMarkdown) {
    htmlContent = renderSimpleMarkdown(rawContent);
  } else {
    htmlContent = await processChapterHtml(rawContent, zip, chapterDir);
  }

  const title =
    targetItem.label || extractTitleFromHtml(rawContent) || `Chapter ${index + 1}`;

  const duration = performance.now() - start;
  console.log(
    `%c[EPUB Parser]%c Extracted Chapter #${index + 1} ("${title}") in ${duration.toFixed(1)}ms`,
    'color: #8b5cf6; font-weight: bold',
    'color: inherit'
  );

  const result: ExtractedChapter = {
    title,
    html: htmlContent,
    isMarkdown,
  };

  memoryCache.set(index, result);
  return result;
}

async function processChapterHtml(
  rawHtml: string,
  zip: JSZip,
  chapterDir: string
): Promise<string> {
  let bodyContent = rawHtml;
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    bodyContent = bodyMatch[1];
  }

  bodyContent = bodyContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');

  const imgRegex = /<(img|image)\s+([^>]+)\/?>/gi;
  const matches: Array<{ full: string; tag: string; attrs: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = imgRegex.exec(bodyContent)) !== null) {
    if (m[0] && m[1] && m[2]) {
      matches.push({ full: m[0], tag: m[1], attrs: m[2] });
    }
  }

  for (const match of matches) {
    const srcMatch = match.attrs.match(/(?:src|xlink:href)=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      const originalSrc = srcMatch[1];
      if (!originalSrc.startsWith('data:') && !originalSrc.startsWith('http')) {
        const decodedSrc = decodeURIComponent(originalSrc);
        const resolvedPath = normalizePath(chapterDir + decodedSrc);
        const imgFile =
          zip.file(resolvedPath) ||
          zip.file(resolvedPath.replace(/^\//, '')) ||
          zip.file(decodedSrc) ||
          zip.file(decodedSrc.replace(/^\//, ''));

        if (imgFile) {
          try {
            const blob = await imgFile.async('blob');
            const blobUrl = URL.createObjectURL(blob);
            memoryCache.trackUrl(blobUrl);
            const newTag = match.full.replace(originalSrc, blobUrl);
            bodyContent = bodyContent.replace(match.full, newTag);
          } catch {}
        }
      }
    }
  }

  return bodyContent;
}

function parseNcxToc(ncxText: string, opfDir: string): TocItem[] {
  const items: TocItem[] = [];
  const navPointRegex =
    /<navPoint[\s\S]*?<navLabel>\s*<text>([\s\S]*?)<\/text>\s*<\/navLabel>[\s\S]*?<content\s+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = navPointRegex.exec(ncxText)) !== null) {
    const rawLabel = match[1] || '';
    const rawSrc = match[2] || '';
    const label = cleanText(rawLabel);
    const src = decodeURIComponent(rawSrc);
    const normalizedHref = normalizePath(opfDir + src);

    items.push({
      id: `ncx-${items.length}`,
      label: label || `Chapter ${items.length + 1}`,
      href: normalizedHref,
    });
  }

  return items;
}

function parseNavToc(navText: string, opfDir: string): TocItem[] {
  const items: TocItem[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(navText)) !== null) {
    const rawHref = match[1] || '';
    const rawLabel = match[2] || '';
    const href = decodeURIComponent(rawHref);
    const label = cleanText(rawLabel.replace(/<[^>]+>/g, ''));
    if (label && href) {
      items.push({
        id: `nav-${items.length}`,
        label,
        href: normalizePath(opfDir + href),
      });
    }
  }

  return items;
}

function extractTitleFromHtml(html: string): string | null {
  const h1Match = html.match(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/i);
  if (h1Match && h1Match[1]) {
    return cleanText(h1Match[1].replace(/<[^>]+>/g, ''));
  }
  return null;
}

function renderSimpleMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      out.push(`<h1>${cleanText(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      out.push(`<h2>${cleanText(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      out.push(`<h3>${cleanText(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('> ')) {
      out.push(`<blockquote>${cleanText(trimmed.slice(2))}</blockquote>`);
    } else {
      out.push(`<p>${cleanText(trimmed)}</p>`);
    }
  }

  return out.join('\n');
}

function normalizePath(path: string): string {
  const segments = path.split('/');
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }
  return resolved.join('/');
}

function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
