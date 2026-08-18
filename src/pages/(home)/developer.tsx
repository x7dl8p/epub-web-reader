import { Code2, Terminal, Cpu, Sparkles } from 'lucide-react';
import { Link } from 'waku/router/client';

export default function DeveloperPage() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
      <div className="border-b border-fd-border pb-4">
        <Link to="/" className="text-xs font-bold text-fd-primary hover:underline mb-2 inline-block">
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-fd-foreground tracking-tight">Developer Information</h1>
        <p className="text-xs sm:text-sm text-fd-muted-foreground mt-1">
          Built with React Server Components, Waku, Fumadocs UI, and JSZip.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="p-5 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-fd-primary">
            <Code2 className="w-5 h-5" />
            <h2 className="font-bold text-base text-fd-foreground">Architecture Stack</h2>
          </div>
          <ul className="text-xs sm:text-sm text-fd-muted-foreground space-y-2 list-disc list-inside">
            <li><strong className="text-fd-foreground">Waku Framework:</strong> Next-gen minimalist React Server Components framework.</li>
            <li><strong className="text-fd-foreground">Fumadocs UI:</strong> Beautiful, accessible documentation & reader layout components.</li>
            <li><strong className="text-fd-foreground">JSZip & DOMParser:</strong> Fast stream-decompression and client-side OPF/NCX XML parsing.</li>
            <li><strong className="text-fd-foreground">IndexedDB (idb):</strong> Offline persistence for binary EPUB archives & reader state.</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-fd-primary">
            <Terminal className="w-5 h-5" />
            <h2 className="font-bold text-base text-fd-foreground">Diagnostic Logging</h2>
          </div>
          <p className="text-xs sm:text-sm text-fd-muted-foreground leading-relaxed">
            If an EPUB file fails to parse, our upload engine automatically collects decompression traces, OPF parsing logs, and stack traces into an interactive debug log modal with one-click copy functionality.
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
