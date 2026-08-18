'use client';

import { useState, useEffect } from 'react';
import { loadPrefs, savePrefs, type ReaderPrefs } from '@/lib/epub-store';
import {
  Sliders,
  Minus,
  Plus,
  AlignLeft,
  AlignJustify,
  AlignCenter,
  X,
  Hash,
  Indent,
  Sparkles,
} from 'lucide-react';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReaderSettingsModal({ isOpen, onClose }: ReaderSettingsModalProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs());

  useEffect(() => {
    if (isOpen) {
      setPrefs(loadPrefs());
    }
  }, [isOpen]);

  const update = (patch: Partial<ReaderPrefs>) => {
    const updated = { ...prefs, ...patch };
    setPrefs(updated);
    savePrefs(patch);
  };

  const sizeOptions: Array<ReaderPrefs['fontSize']> = ['sm', 'md', 'lg', 'xl', '2xl'];
  const currentSizeIdx = sizeOptions.indexOf(prefs.fontSize);

  const handleSmaller = () => {
    if (currentSizeIdx > 0) {
      update({ fontSize: sizeOptions[currentSizeIdx - 1] });
    }
  };

  const handleBigger = () => {
    if (currentSizeIdx < sizeOptions.length - 1) {
      update({ fontSize: sizeOptions[currentSizeIdx + 1] });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-start items-end sm:items-stretch">
      {/* Click outside backdrop without blur so text underneath stays crisp and readable */}
      <div
        className="fixed inset-0 pointer-events-auto bg-black/20 transition-opacity"
        onClick={onClose}
      />

      {/* Left Slide-in Drawer Panel (Desktop) / Half-screen Bottom Sheet (Mobile) */}
      <div
        className="relative pointer-events-auto w-full sm:w-96 max-sm:h-[50vh] max-sm:max-h-[50vh] sm:h-full bg-fd-card/95 border-e max-sm:border-t max-sm:border-e-0 border-fd-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-left duration-200 max-sm:rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-fd-border bg-fd-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-fd-primary/10 text-fd-primary">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-fd-foreground leading-tight">Typography & Layout</h3>
              <p className="text-[11px] text-fd-muted-foreground">Adjust text in real-time</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Font Family */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
              Font Family
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'serif', label: 'Serif (Lora)', fontClass: 'font-serif' },
                { id: 'sans', label: 'Sans (Inter)', fontClass: 'font-sans' },
                { id: 'mono', label: 'Mono (Code)', fontClass: 'font-mono text-[11px]' },
                { id: 'dyslexic', label: 'OpenDyslexic', fontClass: 'font-dyslexic text-[11px]' },
              ].map(({ id, label, fontClass }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ fontFamily: id as ReaderPrefs['fontFamily'] })}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left flex items-center justify-between ${fontClass} ${
                    prefs.fontFamily === id
                      ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold shadow-xs'
                      : 'border-fd-border hover:bg-fd-accent text-fd-foreground'
                  }`}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Stepper */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                Font Size
              </label>
              <span className="text-xs font-bold uppercase text-fd-primary">{prefs.fontSize}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded-2xl bg-fd-secondary/70 border border-fd-border">
              <button
                type="button"
                onClick={handleSmaller}
                disabled={currentSizeIdx === 0}
                className="p-1.5 rounded-xl hover:bg-fd-card disabled:opacity-30 transition-colors cursor-pointer"
                title="Decrease size (A-)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1">
                {sizeOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update({ fontSize: s })}
                    className={`w-7 h-7 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      prefs.fontSize === s
                        ? 'bg-fd-primary text-fd-primary-foreground shadow-xs scale-105'
                        : 'text-fd-muted-foreground hover:bg-fd-card/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleBigger}
                disabled={currentSizeIdx === sizeOptions.length - 1}
                className="p-1.5 rounded-xl hover:bg-fd-card disabled:opacity-30 transition-colors cursor-pointer"
                title="Increase size (A+)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Line Spacing & Letter Spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                Line Height
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(['tight', 'normal', 'relaxed', 'loose'] as const).map((lh) => (
                  <button
                    key={lh}
                    type="button"
                    onClick={() => update({ lineHeight: lh })}
                    className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize cursor-pointer border ${
                      prefs.lineHeight === lh
                        ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                        : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                    }`}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                Letter Spacing
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(['tight', 'normal', 'wide', 'wider'] as const).map((ls) => (
                  <button
                    key={ls}
                    type="button"
                    onClick={() => update({ letterSpacing: ls })}
                    className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize cursor-pointer border ${
                      prefs.letterSpacing === ls
                        ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                        : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                    }`}
                  >
                    {ls}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
              Text Alignment
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'left', label: 'Left', icon: AlignLeft },
                { id: 'justify', label: 'Justify', icon: AlignJustify },
                { id: 'center', label: 'Center', icon: AlignCenter },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ textAlign: id as ReaderPrefs['textAlign'] })}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    prefs.textAlign === id
                      ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                      : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Width */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-fd-muted-foreground uppercase tracking-wider">
              Reading Column Width
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['narrow', 'normal', 'wide', 'full'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => update({ maxWidth: w })}
                  className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize cursor-pointer border ${
                    prefs.maxWidth === w
                      ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                      : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles: First-line Indent & Chapter Numbers in Sidebar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-fd-border">
            {/* Show Chapter Numbers */}
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-fd-secondary/50 transition-colors">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-fd-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-fd-foreground">Chapter Numbers in Sidebar</p>
                  <p className="text-[11px] text-fd-muted-foreground">Prefix chapters with 1, 2, 3...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => update({ showChapterNumbers: !prefs.showChapterNumbers })}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  prefs.showChapterNumbers
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'bg-fd-secondary text-fd-muted-foreground border border-fd-border'
                }`}
              >
                {prefs.showChapterNumbers ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* First-line Indentation */}
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-fd-secondary/50 transition-colors">
              <div className="flex items-center gap-2">
                <Indent className="w-4 h-4 text-fd-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-fd-foreground">First-line Indent</p>
                  <p className="text-[11px] text-fd-muted-foreground">Traditional novel paragraph indent</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => update({ indent: !prefs.indent })}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  prefs.indent
                    ? 'bg-fd-primary text-fd-primary-foreground'
                    : 'bg-fd-secondary text-fd-muted-foreground border border-fd-border'
                }`}
              >
                {prefs.indent ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
