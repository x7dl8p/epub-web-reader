'use client';
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/waku';

// Polyfill crypto.randomUUID for non-localhost HTTP IP origins
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.crypto) {
    win.crypto = {};
  }
  if (!win.crypto.randomUUID) {
    win.crypto.randomUUID = function () {
      if (typeof win.crypto.getRandomValues === 'function') {
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) => {
          const arr = new Uint8Array(1);
          win.crypto.getRandomValues(arr);
          const val = arr[0] || 0;
          return (c ^ (val & (15 >> (c / 4)))).toString(16);
        });
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}
