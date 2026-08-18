# EPUB Web Reader (Novel Reader)

**Live Demo**: [https://epub-web-reader.vercel.app/](https://epub-web-reader.vercel.app/)

A modern, fast, and feature-rich client-side **EPUB Web Reader** built with **Waku** (React Server Components), **Fumadocs UI**, **Tailwind CSS v4**, **JSZip**, and **IndexedDB**.

![Reader with chapter sidebar](public/screenshot-06.png)

![Typography and reader settings drawer](public/screenshot-07.png)

> **[See the full screenshot gallery ->](SHOWCASE.md)** - light & dark themes, mobile layout, custom theming, and large-library navigation.

---

## Features

- **100% Client-Side EPUB Parsing**: Decodes `.epub` archives directly in the browser using `JSZip` and `DOMParser` without uploading files to any backend server.
- **Multi-Book Library**: Upload many EPUBs at once (multi-select or drag a batch in) and keep them side by side — each book stores its own reading position, and uploading a new one never replaces an existing one.
- **Offline Storage & Persistence**: Caches every book and its reading progress locally in **IndexedDB**.
- **Dynamic Site-Wide Theme Engine**: Custom color picker and 5 prebuilt themes (*Default*, *Warm Ivory*, *Classic Sepia*, *Dark Parchment*, *OLED Midnight*) that dynamically override Fuma CSS variables site-wide.
- **Rich Reader Customization**: Adjust font size, line height, letter spacing, font family (*Lora Serif*, *Inter Sans*, *JetBrains Mono*, *OpenDyslexic*), alignment, column width, and paragraph indentation.
- **Two-Page Reading Mode**: Book-style side-by-side columns with a center gutter on wide screens, collapsing to a single column on mobile.
- **Live Chapter Search & Navigation**: Instant search filtering across all chapters in the table of contents.
- **Novel Metadata Management**: Edit novel title/author metadata on the fly or clear storage with one click.
- **Minimalist Dashboard UI**: Ultra-compact, responsive card layout with full-width upload drop zone.

---

## Tech Stack

- **Framework**: [Waku](https://waku.pub/) (React Server Components)
- **UI Components & Layout**: [Fumadocs UI](https://fumadocs.vercel.app/)
- **Styling**: Tailwind CSS v4 & Lucide Icons
- **EPUB Decompression**: JSZip & DOMParser
- **Local Database**: IndexedDB via `idb`

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- `pnpm` (recommended), `npm`, or `yarn`

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/epub-web-reader.git
cd epub-web-reader

# Install dependencies
pnpm install

# Run dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Building for Production

```bash
pnpm build
```

This compiles the static site generation (SSG) bundles into the output directory:
- **Build Output Directory**: `dist/public`

---

## Deployment Configuration (Vercel)

When deploying this project to **Vercel**, use the following configuration:

| Field | Setting |
|---|---|
| **Framework Preset** | `Other` (or `Vite` / `Waku`) |
| **Build Command** | `pnpm build` |
| **Output Directory** | `dist/public` |
| **Install Command** | `pnpm install` |
| **Node.js Version** | `18.x` or `20.x` |

---

## License

MIT License. Built for seamless web novel reading.

