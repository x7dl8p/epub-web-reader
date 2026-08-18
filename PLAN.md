# Novel / EPUB Reader — Build Plan

> Stack: Waku + Fumadocs UI + epub.js · Client-side only · No backend

---

## Context

The workspace already has a **Waku** (React RSC framework) + **Fumadocs UI** scaffold — not Next.js.
We adapt the plan to Waku's file-based routing (`src/pages/`) rather than Next.js `app/`.

---

## Phase 0 — Install Dependencies

```bash
pnpm add epubjs idb
```

- `epubjs` — parse EPUB client-side (TOC + chapter HTML)
- `idb` — thin IndexedDB wrapper for persistence

---

## Phase 1 — Wipe & Repurpose Existing Pages

| File | Action |
|---|---|
| `src/pages/(home)/index.tsx` | Replace with Upload / Landing page |
| `src/pages/docs/_layout.tsx` | Replace with Reader layout (Fumadocs DocsLayout + custom tree) |
| `src/pages/docs/[...slugs].tsx` | Replace with Chapter renderer |

---

## Phase 2 — Core State & Persistence (src/lib/)

### src/lib/epub-store.ts
- `saveBook(file: File)` → store raw EPUB bytes in IndexedDB
- `loadBook()` → retrieve bytes, reconstruct Blob
- `savePrefs(prefs)` / `loadPrefs()` → localStorage for { chapterId, fontSize, fontFamily }

### src/lib/epub-parser.ts (client-only)
- `parseEpub(blob)` → uses epubjs to return { toc: TocItem[], getChapter(href) → HTML string }
- `TocItem = { id, label, href }`

---

## Phase 3 — Landing Page (src/pages/(home)/index.tsx)

- Full-screen centered upload zone
- Drag-and-drop + <input type="file" accept=".epub">
- On drop/select:
  1. Save raw bytes to IndexedDB via saveBook()
  2. Parse TOC with parseEpub()
  3. Save parsed TOC to localStorage
  4. Navigate to /reader/0 (first chapter)
- If book already in IndexedDB on load → show "Continue reading" button

---

## Phase 4 — Reader Layout (src/pages/reader/_layout.tsx)

Wrap with Fumadocs DocsLayout:
- Build a dynamic page tree from TOC stored in localStorage
- Each TOC item → a node with href = /reader/<index>
- Pass tree to DocsLayout tree={dynamicTree} — sidebar renders chapter list automatically
- Keep Fumadocs' built-in ThemeToggle in the navbar

---

## Phase 5 — Chapter Page (src/pages/reader/[chapter].tsx)

- Read chapter index from URL params
- Load EPUB from IndexedDB → call getChapter(href)
- Render HTML via dangerouslySetInnerHTML inside DocsBody
- Apply font-size + font-family CSS vars from prefs
- On mount → save current chapter index to localStorage

---

## Phase 6 — Settings Toolbar

Small inline panel inside the reader page (no separate route):

  [A-] [A+]   Font: [Serif ▾]

| Control | Values |
|---|---|
| Font size | sm / md / lg / xl → 14 / 16 / 19 / 22px |
| Font family | Serif, Sans-serif, Dyslexic (OpenDyslexic) |

Changes written immediately to localStorage prefs and applied via inline style on content wrapper.

---

## Phase 7 — Styling

- Load OpenDyslexic from CDN for dyslexia font option
- Minimal overrides on Fumadocs prose classes for epub HTML content
- Everything else stays as Fumadocs default (light/dark toggle included)

---

## File Map (final)

```
src/
├── lib/
│   ├── epub-store.ts       # IndexedDB save/load + localStorage prefs
│   ├── epub-parser.ts      # epubjs wrapper → TOC + chapter HTML
│   └── layout.shared.ts    # keep existing Fumadocs base options
├── pages/
│   ├── (home)/
│   │   └── index.tsx       # Upload landing page
│   └── reader/
│       ├── _layout.tsx     # DocsLayout with dynamic chapter tree
│       └── [chapter].tsx   # Chapter renderer + settings toolbar
├── components/
│   ├── upload-zone.tsx     # Drag-drop file input component
│   └── reader-settings.tsx # Font size + family controls
└── styles/
    └── globals.css         # Minimal epub content overrides
```

---

## Data Flow

```
Upload → IndexedDB (raw epub bytes)
       → localStorage (TOC JSON, prefs)
             ↓
Reader layout reads TOC → builds Fumadocs sidebar tree
Chapter page reads IndexedDB → epubjs → render HTML
Settings panel writes → localStorage prefs → CSS vars applied
```

---

## Out of Scope

- No multi-book library
- No backend / API
- No auth / accounts
- No sepia / extra themes
- No shareable links
