import { BookOpen, ShieldCheck, Zap, Heart } from 'lucide-react';
import { Link } from 'waku/router/client';

export default function AboutPage() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
      <div className="border-b border-fd-border pb-4">
        <Link to="/" className="text-xs font-bold text-fd-primary hover:underline mb-2 inline-block">
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-fd-foreground tracking-tight">About Novel Reader</h1>
        <p className="text-xs sm:text-sm text-fd-muted-foreground mt-1">
          A high-performance, privacy-focused, offline-first web EPUB reader.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">100% Client-Side Privacy</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Your books and reading progress never leave your browser. EPUB files are decompressed and stored locally in IndexedDB.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">Instant Table of Contents</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Even massive novels with 1,000+ chapters render instantly with batch grouping and full-text chapter search.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">Tailored Reading Experience</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Customize typography, column width, line height, open-dyslexic font, and custom color themes on the fly.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Heart className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">Clean CRM Dashboard</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Minimal, ultra-compact interface designed for speed, zero distractions, and seamless reading continuity.
          </p>
        </div>
      </div>
    </div>
  );
}

export async function getConfig() {
  return {
    render: 'static',
  } as const;
}
