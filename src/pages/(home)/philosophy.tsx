import { Compass, Eye, Shield, Feather } from 'lucide-react';
import { Link } from 'waku/router/client';

export default function PhilosophyPage() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
      <div className="border-b border-fd-border pb-4">
        <Link to="/" className="text-xs font-bold text-fd-primary hover:underline mb-2 inline-block">
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-fd-foreground tracking-tight">Design Philosophy</h1>
        <p className="text-xs sm:text-sm text-fd-muted-foreground mt-1">
          Simplicity, performance, and respectful design for readers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Feather className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">Distraction-Free Immersion</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Reading requires deep focus. The reader header hides on scroll, text margins adapt smoothly, and all controls reside in a clean non-blurry side panel.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Eye className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">Accessibility First</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Including support for OpenDyslexic typography, custom letter spacing, line height steppers, and personalized background/text contrast colors.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Shield className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">User Ownership</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            No forced cloud logins, no tracking telemetry, and no artificial file lock-in. Your EPUBs belong to you.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-2">
          <div className="p-2 rounded-xl bg-fd-primary/10 text-fd-primary w-fit">
            <Compass className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-sm text-fd-foreground">CRM Minimal Aesthetics</h2>
          <p className="text-xs text-fd-muted-foreground leading-relaxed">
            Clean data strips, tight spacing, clear status indicators, and fast navigation without generic marketing hero bloat.
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
