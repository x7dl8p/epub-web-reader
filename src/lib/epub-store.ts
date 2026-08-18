import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'novel-reader-db';
const DB_VERSION = 3;
const STORE_BOOKS = 'books';
const STORE_META = 'book-meta';

// v2 stored exactly one book under these fixed keys. v3 keys every record by book id
// instead; these are only read once, by the migration below.
const LEGACY_BOOK_KEY = 'active-book';
const LEGACY_META_KEY = 'active-meta';

const ACTIVE_ID_STORAGE_KEY = 'novel-reader-active-book-id';
const PREFS_STORAGE_KEY = 'novel-reader-prefs-v2';

export interface ReaderPrefs {
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fontFamily: 'serif' | 'sans' | 'mono' | 'dyslexic';
  fontWeight: 'light' | 'normal' | 'medium' | 'bold';
  lineHeight: 'tight' | 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'tight' | 'normal' | 'wide' | 'wider';
  textAlign: 'left' | 'justify' | 'center';
  maxWidth: 'narrow' | 'normal' | 'wide' | 'full';
  indent: boolean;
  showChapterNumbers: boolean;
  /** Render the chapter as two side-by-side newspaper columns on wide screens. */
  twoPageMode: boolean;
  /** Left/right page margin in px. 0 = text runs edge to edge. */
  marginX: number;
  /** Top/bottom page margin in px. 0 = text runs edge to edge. */
  marginY: number;
  /** Custom reading background color (hex). Empty string = use theme default. */
  bgColor: string;
  /** Custom reading text color (hex). Empty string = use theme default. */
  textColor: string;
}

export const DEFAULT_PREFS: ReaderPrefs = {
  fontSize: 'md',
  fontFamily: 'serif',
  fontWeight: 'normal',
  lineHeight: 'relaxed',
  letterSpacing: 'normal',
  textAlign: 'left',
  maxWidth: 'normal',
  indent: true,
  showChapterNumbers: true,
  twoPageMode: false,
  marginX: 34,
  marginY: 11,
  bgColor: '',
  textColor: '',
};

export interface TocItem {
  id: string;
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface SpineItem {
  id: string;
  href: string;
  rawHref: string;
  mediaType: string;
  label?: string;
}

export interface CachedBookMeta {
  title: string;
  creator?: string;
  coverDataUrl?: string;
  opfDir: string;
  spine: SpineItem[];
  toc: TocItem[];
  totalChapters: number;
}

/** One book in the library. Reading progress lives here so books don't share it. */
export interface StoredBook {
  id: string;
  meta: CachedBookMeta;
  addedAt: number;
  lastOpenedAt: number;
  chapterIndex: number;
  sizeBytes: number;
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Metadata of books already read this session, so remounts can render synchronously
// instead of flashing empty while IndexedDB is re-read.
const metaMemoryCache = new Map<string, CachedBookMeta>();

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      },
    }).then(async (db) => {
      await migrateLegacySingleBook(db);
      return db;
    });
  }
  return dbPromise;
}

/**
 * Moves a book saved by the old single-slot layout into a keyed library record.
 * Runs in its own transaction after the connection opens, so a failure here can
 * never abort the version-change upgrade and leave the stores half-built.
 */
async function migrateLegacySingleBook(db: IDBPDatabase): Promise<void> {
  try {
    const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
    const books = tx.objectStore(STORE_BOOKS);
    const metas = tx.objectStore(STORE_META);

    const legacyMeta = (await metas.get(LEGACY_META_KEY)) as CachedBookMeta | undefined;
    const legacyBuffer = (await books.get(LEGACY_BOOK_KEY)) as ArrayBuffer | undefined;

    if (legacyMeta && legacyBuffer) {
      const id = newId();
      const now = Date.now();

      // v2 kept reading progress in the shared prefs blob; carry it onto the record.
      let chapterIndex = 0;
      try {
        const raw = localStorage.getItem(PREFS_STORAGE_KEY);
        if (raw) chapterIndex = JSON.parse(raw)?.chapterIndex || 0;
      } catch {}

      const record: StoredBook = {
        id,
        meta: legacyMeta,
        addedAt: now,
        lastOpenedAt: now,
        chapterIndex,
        sizeBytes: legacyBuffer.byteLength,
      };

      await books.put(legacyBuffer, id);
      await metas.put(record, id);
      await books.delete(LEGACY_BOOK_KEY);
      await metas.delete(LEGACY_META_KEY);

      if (!getActiveBookId()) setActiveBookId(id);
      console.log(`[Library] Migrated "${legacyMeta.title}" from the old single-book store.`);
    }

    await tx.done;
  } catch (err) {
    console.error('Failed to migrate legacy book record:', err);
  }
}

export function getActiveBookId(): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(ACTIVE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveBookId(id: string | null): void {
  if (!isClient()) return;
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ID_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_ID_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('active-book-changed', { detail: id }));
  } catch (err) {
    console.error('Failed to set active book:', err);
  }
}

/** Every book in the library, most recently opened first. */
export async function listBooks(): Promise<StoredBook[]> {
  if (!isClient()) return [];
  try {
    const db = await getDB();
    const records = (await db.getAll(STORE_META)) as StoredBook[];
    for (const record of records) {
      if (record?.id && record.meta) metaMemoryCache.set(record.id, record.meta);
    }
    return records
      .filter((record) => record && record.id && record.meta)
      .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  } catch (err) {
    console.error('Failed to list books:', err);
    return [];
  }
}

export async function getBook(id: string): Promise<StoredBook | null> {
  if (!isClient() || !id) return null;
  try {
    const db = await getDB();
    const record = (await db.get(STORE_META, id)) as StoredBook | undefined;
    if (record?.meta) metaMemoryCache.set(id, record.meta);
    return record || null;
  } catch (err) {
    console.error('Failed to load book record:', err);
    return null;
  }
}

/**
 * Adds a book to the library and makes it active. Re-uploading a book that is
 * already stored updates it in place (matched on title + chapter count) rather
 * than creating a duplicate entry.
 */
export async function saveBook(buffer: ArrayBuffer, meta: CachedBookMeta): Promise<string | null> {
  if (!isClient()) return null;

  const db = await getDB();
  const existing = (await db.getAll(STORE_META)) as StoredBook[];
  const duplicate = existing.find(
    (record) =>
      record?.meta?.title === meta.title && record?.meta?.totalChapters === meta.totalChapters
  );

  const now = Date.now();
  const id = duplicate?.id || newId();
  const record: StoredBook = {
    id,
    meta,
    addedAt: duplicate?.addedAt || now,
    lastOpenedAt: now,
    chapterIndex: duplicate?.chapterIndex || 0,
    sizeBytes: buffer.byteLength,
  };

  const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_BOOKS).put(buffer, id),
    tx.objectStore(STORE_META).put(record, id),
    tx.done,
  ]);

  metaMemoryCache.set(id, meta);
  setActiveBookId(id);
  return id;
}

/** Raw EPUB bytes for a book. Defaults to the active book. */
export async function loadBookBuffer(id?: string): Promise<ArrayBuffer | null> {
  if (!isClient()) return null;
  const bookId = id || getActiveBookId();
  if (!bookId) return null;
  try {
    const db = await getDB();
    const data = await db.get(STORE_BOOKS, bookId);
    return (data as ArrayBuffer) || null;
  } catch (err) {
    console.error('Failed to load book buffer from IndexedDB:', err);
    return null;
  }
}

/** Parsed metadata for a book. Defaults to the active book. */
export async function loadCachedMeta(id?: string): Promise<CachedBookMeta | null> {
  if (!isClient()) return null;
  const bookId = id || getActiveBookId();
  if (!bookId) return null;
  const record = await getBook(bookId);
  return record?.meta || null;
}

/** Active book metadata already held in memory, for a flash-free first paint. */
export function getCachedMetaSync(): CachedBookMeta | null {
  const id = getActiveBookId();
  if (!id) return null;
  return metaMemoryCache.get(id) || null;
}

export async function hasSavedBook(): Promise<boolean> {
  const books = await listBooks();
  return books.length > 0;
}

export async function updateBookMeta(id: string, meta: CachedBookMeta): Promise<void> {
  if (!isClient() || !id) return;
  try {
    const db = await getDB();
    const record = (await db.get(STORE_META, id)) as StoredBook | undefined;
    if (!record) return;
    await db.put(STORE_META, { ...record, meta }, id);
    metaMemoryCache.set(id, meta);
  } catch (err) {
    console.error('Failed to update book metadata:', err);
  }
}

/** Records reading position for one book without touching the others. */
export async function saveProgress(id: string, chapterIndex: number): Promise<void> {
  if (!isClient() || !id) return;
  try {
    const db = await getDB();
    const record = (await db.get(STORE_META, id)) as StoredBook | undefined;
    if (!record) return;
    if (record.chapterIndex === chapterIndex) return;
    await db.put(STORE_META, { ...record, chapterIndex, lastOpenedAt: Date.now() }, id);
  } catch (err) {
    console.error('Failed to save reading progress:', err);
  }
}

export async function deleteBook(id: string): Promise<void> {
  if (!isClient() || !id) return;
  try {
    const db = await getDB();
    const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_BOOKS).delete(id),
      tx.objectStore(STORE_META).delete(id),
      tx.done,
    ]);
    metaMemoryCache.delete(id);

    // Hand the active slot to whatever is left so the reader never points at a gap.
    if (getActiveBookId() === id) {
      const remaining = await listBooks();
      setActiveBookId(remaining[0]?.id || null);
    }
  } catch (err) {
    console.error('Failed to delete book:', err);
  }
}

export async function clearAllBooks(): Promise<void> {
  if (!isClient()) return;
  try {
    const db = await getDB();
    const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_BOOKS).clear(),
      tx.objectStore(STORE_META).clear(),
      tx.done,
    ]);
    metaMemoryCache.clear();
    setActiveBookId(null);
  } catch (err) {
    console.error('Failed to clear library:', err);
  }
}

export function savePrefs(prefs: Partial<ReaderPrefs>): void {
  if (!isClient()) return;
  try {
    const current = loadPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom storage event for sync across layout and settings
    window.dispatchEvent(new CustomEvent('reader-prefs-changed', { detail: updated }));
  } catch (err) {
    console.error('Failed to save prefs:', err);
  }
}

export function loadPrefs(): ReaderPrefs {
  if (!isClient()) return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
