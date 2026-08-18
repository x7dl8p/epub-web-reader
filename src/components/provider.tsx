'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/waku';
import { loadPrefs, savePrefs, type ReaderPrefs } from '@/lib/epub-store';
import { applyCustomTheme, removeCustomTheme } from '@/lib/theme-injector';

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
  const [showThemeWarning, setShowThemeWarning] = useState(false);
  const [pendingThemeAction, setPendingThemeAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const prefs = loadPrefs();
    applyCustomTheme(prefs.bgColor, prefs.textColor);

    const handlePrefsChange = (e: Event) => {
      const event = e as CustomEvent<ReaderPrefs>;
      const updated = event.detail || loadPrefs();
      applyCustomTheme(updated.bgColor || '', updated.textColor || '');
    };

    window.addEventListener('reader-prefs-changed', handlePrefsChange);
    return () => {
      window.removeEventListener('reader-prefs-changed', handlePrefsChange);
    };
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const themeBtn = target.closest(
        'button[data-theme-toggle], .fd-theme-toggle, button[aria-label*="theme" i], button[aria-label*="light" i], button[aria-label*="dark" i], button[aria-label*="mode" i]'
      );

      const isToggle =
        themeBtn &&
        (themeBtn.hasAttribute('data-theme-toggle') ||
          themeBtn.closest('[data-theme-toggle], .fd-theme-toggle') ||
          themeBtn.getAttribute('aria-label')?.toLowerCase().includes('theme') ||
          themeBtn.getAttribute('aria-label')?.toLowerCase().includes('light') ||
          themeBtn.getAttribute('aria-label')?.toLowerCase().includes('dark') ||
          themeBtn.getAttribute('aria-label')?.toLowerCase().includes('mode'));

      if (isToggle) {
        const currentPrefs = loadPrefs();
        if (currentPrefs.bgColor || currentPrefs.textColor) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          setPendingThemeAction(() => () => {
            savePrefs({ bgColor: '', textColor: '' });
            removeCustomTheme();
            (themeBtn as HTMLElement).click();
          });
          setShowThemeWarning(true);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => {
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  return (
    <RootProvider>
      {children}

      {showThemeWarning && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-sm p-5 rounded-2xl border border-fd-border bg-fd-card text-fd-foreground shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-sm text-fd-foreground mb-1.5">Reset Custom Theme?</h3>
            <p className="text-xs text-fd-muted-foreground leading-relaxed mb-4">
              Switching the main site theme will reset your custom reading background and text colors back to default.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowThemeWarning(false);
                  setPendingThemeAction(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-fd-border text-xs font-medium hover:bg-fd-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowThemeWarning(false);
                  if (pendingThemeAction) {
                    pendingThemeAction();
                  }
                  setPendingThemeAction(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
              >
                Reset & Switch Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </RootProvider>
  );
}

