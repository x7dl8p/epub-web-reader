import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'novel-reader-db';
const DB_VERSION = 2;
const STORE_BOOKS = 'books';
const STORE_META = 'book-meta';
const BOOK_KEY = 'active-book';
const META_KEY_ID = 'active-meta';

export interface ReaderPrefs {
  chapterIndex: number;
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fontFamily: 'serif' | 'sans' | 'mono' | 'dyslexic';
  lineHeight: 'tight' | 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'tight' | 'normal' | 'wide' | 'wider';
  textAlign: 'left' | 'justify' | 'center';
  maxWidth: 'narrow' | 'normal' | 'wide' | 'full';
  indent: boolean;
  showChapterNumbers: boolean;
  /** Custom reading background color (hex). Empty string = use theme default. */
  bgColor: string;
  /** Custom reading text color (hex). Empty string = use theme default. */
  textColor: string;
}

export const DEFAULT_PREFS: ReaderPrefs = {
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

const PREFS_STORAGE_KEY = 'novel-reader-prefs-v2';

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

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    },
  });
}

export async function updateCachedMeta(meta: CachedBookMeta): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  await db.put(STORE_META, meta, META_KEY_ID);
}

export async function saveBook(buffer: ArrayBuffer, meta: CachedBookMeta): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
  await Promise.all([
    tx.objectStore(STORE_BOOKS).put(buffer, BOOK_KEY),
    tx.objectStore(STORE_META).put(meta, META_KEY_ID),
    tx.done,
  ]);
}

export async function loadBookBuffer(): Promise<ArrayBuffer | null> {
  if (!isClient()) return null;
  try {
    const db = await getDB();
    const data = await db.get(STORE_BOOKS, BOOK_KEY);
    return (data as ArrayBuffer) || null;
  } catch (err) {
    console.error('Failed to load book buffer from IndexedDB:', err);
    return null;
  }
}

export async function loadCachedMeta(): Promise<CachedBookMeta | null> {
  if (!isClient()) return null;
  try {
    const db = await getDB();
    const meta = await db.get(STORE_META, META_KEY_ID);
    return (meta as CachedBookMeta) || null;
  } catch (err) {
    console.error('Failed to load book meta from IndexedDB:', err);
    return null;
  }
}

export async function hasSavedBook(): Promise<boolean> {
  if (!isClient()) return false;
  try {
    const db = await getDB();
    const meta = await db.get(STORE_META, META_KEY_ID);
    return !!meta;
  } catch {
    return false;
  }
}

export async function clearBook(): Promise<void> {
  if (!isClient()) return;
  try {
    const db = await getDB();
    const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_BOOKS).delete(BOOK_KEY),
      tx.objectStore(STORE_META).delete(META_KEY_ID),
      tx.done,
    ]);
    localStorage.removeItem(PREFS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear book:', err);
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
