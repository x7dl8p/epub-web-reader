'use client';

import { useState, useEffect } from 'react';
import { Code2, Terminal, Cpu, HardDrive, RefreshCw } from 'lucide-react';

export default function DeveloperPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<string>('Checking...');

  useEffect(() => {
    const initialLogs: string[] = [
      `[SYS] Engine Initialization: Waku RSC + Fumadocs UI`,
      `[SYS] User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'}`,
      `[SYS] Screen Resolution: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}`,
      `[SYS] Language: ${typeof navigator !== 'undefined' ? navigator.language : 'en'}`,
    ];

    if (typeof window !== 'undefined' && 'storage' in navigator && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        const usageMb = estimate.usage ? (estimate.usage / (1024 * 1024)).toFixed(2) : '0';
        const quotaMb = estimate.quota ? (estimate.quota / (1024 * 1024)).toFixed(2) : '0';
        setStorageInfo({ usage: `${usageMb} MB`, quota: `${quotaMb} MB` });
        initialLogs.push(`[STORAGE] Quota Estimate: ${usageMb} MB used out of ${quotaMb} MB available`);
        setLogs([...initialLogs]);
      }).catch(() => {
        setLogs([...initialLogs]);
      });
    } else {
      setLogs(initialLogs);
    }

    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const request = indexedDB.open('novel-reader-db');
      request.onsuccess = () => {
        setDbStatus('Active & Ready');
        request.result.close();
      };
      request.onerror = () => {
        setDbStatus('Error Opening DB');
      };
    } else {
      setDbStatus('Not Supported');
    }
  }, []);

  const refreshLogs = () => {
    setLogs((prev) => [...prev, `[USER] Diagnostics manually refreshed at ${new Date().toLocaleTimeString()}`]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
      <div className="border-b border-fd-border pb-4">
        <h1 className="text-2xl font-bold text-fd-foreground tracking-tight">Developer & Diagnostics</h1>
        <p className="text-xs sm:text-sm text-fd-muted-foreground mt-1">
          System telemetry, framework architecture, and real-time client diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-fd-primary">
            <Code2 className="w-5 h-5" />
            <h2 className="font-bold text-base text-fd-foreground">Architecture Stack</h2>
          </div>
          <ul className="text-xs sm:text-sm text-fd-muted-foreground space-y-2 list-disc list-inside">
            <li><strong className="text-fd-foreground">Waku:</strong> Minimalist React Server Components framework</li>
            <li><strong className="text-fd-foreground">Fumadocs UI:</strong> Layout engine & CSS design tokens</li>
            <li><strong className="text-fd-foreground">JSZip & DOMParser:</strong> Client-side binary EPUB decompression & OPF parser</li>
            <li><strong className="text-fd-foreground">IndexedDB:</strong> Offline persistent book storage</li>
          </ul>
        </div>

        <div className="p-5 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-fd-primary">
            <HardDrive className="w-5 h-5" />
            <h2 className="font-bold text-base text-fd-foreground">Storage & Environment</h2>
          </div>
          <div className="text-xs sm:text-sm text-fd-muted-foreground flex flex-col gap-2">
            <p><strong className="text-fd-foreground">IndexedDB Status:</strong> <span className="text-fd-primary font-semibold">{dbStatus}</span></p>
            <p><strong className="text-fd-foreground">Storage Used:</strong> {storageInfo?.usage || 'Calculating...'}</p>
            <p><strong className="text-fd-foreground">Total Quota:</strong> {storageInfo?.quota || 'Calculating...'}</p>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-fd-border bg-fd-card/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-fd-primary">
            <Terminal className="w-5 h-5" />
            <h2 className="font-bold text-base text-fd-foreground">Live Telemetry & Event Logs</h2>
          </div>
          <button
            type="button"
            onClick={refreshLogs}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-fd-border text-xs text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="bg-black/90 text-green-400 font-mono text-xs p-4 rounded-xl max-h-60 overflow-y-auto border border-fd-border flex flex-col gap-1">
          {logs.map((log, index) => (
            <p key={index} className="break-all">{log}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
