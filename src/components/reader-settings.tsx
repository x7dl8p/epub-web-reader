'use client';

import { useState, useEffect } from 'react';
import { loadPrefs, savePrefs, type ReaderPrefs } from '@/lib/epub-store';
import { applyCustomTheme, removeCustomTheme } from '@/lib/theme-injector';
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
  Palette,
  Columns2,
  ChevronLeft,
  Check,
  RotateCcw,
} from 'lucide-react';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PREBUILT_THEMES = [
  { id: 'default', name: 'Default Site Theme', bg: '', text: '' },
  { id: 'ivory', name: 'Warm Ivory', bg: '#FDFBF7', text: '#2D2A26' },
  { id: 'sepia', name: 'Classic Sepia', bg: '#F4ECD8', text: '#5B4636' },
  { id: 'dark-parchment', name: 'Dark Parchment', bg: '#1E1C1A', text: '#E6E1DA' },
  { id: 'midnight', name: 'OLED Midnight', bg: '#000000', text: '#D1D5DB' },
];

export function ReaderSettingsModal({ isOpen, onClose }: ReaderSettingsModalProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs());
  const [activeTab, setActiveTab] = useState<'main' | 'custom-theme'>('main');

  // Temp state for color pickers inside sub-page before saving
  const [tempBgColor, setTempBgColor] = useState<string>('#ffffff');
  const [tempTextColor, setTempTextColor] = useState<string>('#000000');

  useEffect(() => {
    if (isOpen) {
      const current = loadPrefs();
      setPrefs(current);
      setTempBgColor(current.bgColor || '#ffffff');
      setTempTextColor(current.textColor || '#000000');
      setActiveTab('main');
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

  const handleSaveCustomColors = (bg: string, text: string) => {
    update({ bgColor: bg, textColor: text });
    // Immediately apply to entire site via Fuma CSS variables
    if (bg && text) {
      applyCustomTheme(bg, text);
    } else {
      removeCustomTheme();
    }
    setActiveTab('main');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-start items-end sm:items-stretch">
      {/* Backdrop */}
      <div
        className="fixed inset-0 pointer-events-auto bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Left Slide-in Drawer Panel (w-80 compact) / Bottom Sheet on Mobile */}
      <div
        className="relative pointer-events-auto w-full sm:w-80 max-sm:h-[50vh] max-sm:max-h-[50vh] sm:h-full bg-fd-card/95 border-e max-sm:border-t max-sm:border-e-0 border-fd-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-left duration-200 max-sm:rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Slim Drawer Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-fd-border bg-fd-card shrink-0">
          <div className="flex items-center gap-2">
            {activeTab === 'custom-theme' ? (
              <button
                type="button"
                onClick={() => setActiveTab('main')}
                className="p-1 rounded-lg hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-fd-primary/10 text-fd-primary">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-bold text-xs text-fd-foreground">Typography & Reader</h3>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        {activeTab === 'main' ? (
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-4">
            {/* Custom Theme Sub-Page Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setTempBgColor(prefs.bgColor || '#ffffff');
                setTempTextColor(prefs.textColor || '#000000');
                setActiveTab('custom-theme');
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-fd-primary/40 bg-fd-primary/10 hover:bg-fd-primary/15 text-fd-primary transition-all cursor-pointer shadow-2xs group"
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-fd-primary" />
                <span className="text-xs font-bold">Custom Reading Theme</span>
              </div>
              <span className="text-[11px] font-semibold opacity-80 group-hover:translate-x-0.5 transition-transform">
                Configure →
              </span>
            </button>

            {/* Font Family */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                Font Family
              </label>
              <div className="grid grid-cols-2 gap-1.5">
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
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer text-left flex items-center justify-between ${fontClass} ${
                      prefs.fontFamily === id
                        ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold shadow-2xs'
                        : 'border-fd-border hover:bg-fd-accent text-fd-foreground'
                    }`}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size Stepper */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Font Size
                </label>
                <span className="text-xs font-bold uppercase text-fd-primary">{prefs.fontSize}</span>
              </div>
              <div className="flex items-center justify-between p-1 rounded-xl bg-fd-secondary/70 border border-fd-border">
                <button
                  type="button"
                  onClick={handleSmaller}
                  disabled={currentSizeIdx === 0}
                  className="p-1 rounded-lg hover:bg-fd-card disabled:opacity-30 transition-colors cursor-pointer"
                  title="Decrease size"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update({ fontSize: s })}
                      className={`w-6 h-6 rounded-md text-[11px] font-bold uppercase transition-all cursor-pointer ${
                        prefs.fontSize === s
                          ? 'bg-fd-primary text-fd-primary-foreground shadow-2xs scale-105'
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
                  className="p-1 rounded-lg hover:bg-fd-card disabled:opacity-30 transition-colors cursor-pointer"
                  title="Increase size"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Line Height, Letter Spacing & Font Boldness */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Line Height
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['tight', 'normal', 'relaxed', 'loose'] as const).map((lh) => (
                    <button
                      key={lh}
                      type="button"
                      onClick={() => update({ lineHeight: lh })}
                      className={`py-1 rounded-md text-[10px] font-medium transition-colors capitalize cursor-pointer border ${
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

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Letter Spacing
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['tight', 'normal', 'wide', 'wider'] as const).map((ls) => (
                    <button
                      key={ls}
                      type="button"
                      onClick={() => update({ letterSpacing: ls })}
                      className={`py-1 rounded-md text-[10px] font-medium transition-colors capitalize cursor-pointer border ${
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

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Font Boldness
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['light', 'normal', 'medium', 'bold'] as const).map((fw) => (
                    <button
                      key={fw}
                      type="button"
                      onClick={() => update({ fontWeight: fw as ReaderPrefs['fontWeight'] })}
                      className={`py-1 rounded-md text-[10px] font-medium transition-colors capitalize cursor-pointer border ${
                        (prefs.fontWeight || 'normal') === fw
                          ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                          : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                      }`}
                    >
                      {fw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Text Alignment */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                Text Alignment
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'left', label: 'Left', icon: AlignLeft },
                  { id: 'justify', label: 'Justify', icon: AlignJustify },
                  { id: 'center', label: 'Center', icon: AlignCenter },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ textAlign: id as ReaderPrefs['textAlign'] })}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      prefs.textAlign === id
                        ? 'border-fd-primary bg-fd-primary/10 text-fd-primary font-bold'
                        : 'border-transparent bg-fd-secondary hover:bg-fd-accent text-fd-foreground'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Margins */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Page Margins
                </label>
                <button
                  type="button"
                  onClick={() => update({ marginX: 0, marginY: 0 })}
                  className="text-[10px] font-semibold text-fd-primary hover:underline cursor-pointer"
                  title="Remove all margins"
                >
                  Edge to edge
                </button>
              </div>

              <div className="flex flex-col gap-2 p-2 rounded-xl bg-fd-secondary/60 border border-fd-border">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-fd-foreground">Left / Right</span>
                    <span className="font-mono text-fd-muted-foreground tabular-nums">
                      {prefs.marginX}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={2}
                    value={prefs.marginX}
                    onChange={(e) => update({ marginX: Number(e.target.value) })}
                    className="w-full accent-fd-primary cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-fd-foreground">Top / Bottom</span>
                    <span className="font-mono text-fd-muted-foreground tabular-nums">
                      {prefs.marginY}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={2}
                    value={prefs.marginY}
                    onChange={(e) => update({ marginY: Number(e.target.value) })}
                    className="w-full accent-fd-primary cursor-pointer"
                  />
                </div>
              </div>
            </div>



            {/* Toggles */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-fd-border">
              <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-fd-secondary/50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-fd-muted-foreground" />
                  <span className="text-xs font-semibold text-fd-foreground">Chapter Numbers</span>
                </div>
                <button
                  type="button"
                  onClick={() => update({ showChapterNumbers: !prefs.showChapterNumbers })}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    prefs.showChapterNumbers
                      ? 'bg-fd-primary text-fd-primary-foreground'
                      : 'bg-fd-secondary text-fd-muted-foreground border border-fd-border'
                  }`}
                >
                  {prefs.showChapterNumbers ? 'On' : 'Off'}
                </button>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-fd-secondary/50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <Columns2 className="w-3.5 h-3.5 text-fd-muted-foreground" />
                  <span className="text-xs font-semibold text-fd-foreground">Two-Page Reading</span>
                </div>
                <button
                  type="button"
                  onClick={() => update({ twoPageMode: !prefs.twoPageMode })}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    prefs.twoPageMode
                      ? 'bg-fd-primary text-fd-primary-foreground'
                      : 'bg-fd-secondary text-fd-muted-foreground border border-fd-border'
                  }`}
                >
                  {prefs.twoPageMode ? 'On' : 'Off'}
                </button>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-fd-secondary/50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <Indent className="w-3.5 h-3.5 text-fd-muted-foreground" />
                  <span className="text-xs font-semibold text-fd-foreground">Paragraph Indent</span>
                </div>
                <button
                  type="button"
                  onClick={() => update({ indent: !prefs.indent })}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    prefs.indent
                      ? 'bg-fd-primary text-fd-primary-foreground'
                      : 'bg-fd-secondary text-fd-muted-foreground border border-fd-border'
                  }`}
                >
                  {prefs.indent ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Custom Theme Sub-Page */
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-fd-border pb-2">
                <h4 className="font-bold text-xs text-fd-foreground">Custom Theme Setup</h4>
                <button
                  type="button"
                  onClick={() => {
                    setTempBgColor('');
                    setTempTextColor('');
                    removeCustomTheme();
                    handleSaveCustomColors('', '');
                  }}
                  className="text-[10px] text-fd-muted-foreground hover:text-fd-foreground flex items-center gap-1 cursor-pointer"
                  title="Reset to default theme"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Section 1: Pre-built Themes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Prebuilt Themes (4-5 Options)
                </label>
                <div className="flex flex-col gap-1.5">
                  {PREBUILT_THEMES.map((theme) => {
                    const isSelected =
                      (theme.id === 'default' && !tempBgColor && !tempTextColor) ||
                      (theme.bg && tempBgColor.toLowerCase() === theme.bg.toLowerCase());

                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setTempBgColor(theme.bg);
                          setTempTextColor(theme.text);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'border-fd-primary bg-fd-primary/10 font-bold shadow-2xs'
                            : 'border-fd-border hover:bg-fd-accent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {theme.bg ? (
                            <div
                              className="w-4 h-4 rounded-full border border-fd-border shrink-0"
                              style={{ backgroundColor: theme.bg }}
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-dashed border-fd-muted-foreground shrink-0 bg-fd-background" />
                          )}
                          <span className="text-fd-foreground">{theme.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-fd-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Color Wheels / Pickers */}
              <div className="flex flex-col gap-3 pt-2 border-t border-fd-border">
                <label className="text-[10px] font-bold text-fd-muted-foreground uppercase tracking-wider">
                  Custom Color Pickers
                </label>

                {/* Background Color Wheel */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-fd-secondary/60 border border-fd-border">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tempBgColor || '#ffffff'}
                      onChange={(e) => setTempBgColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <div>
                      <p className="text-xs font-semibold text-fd-foreground">Background Color</p>
                      <p className="text-[10px] text-fd-muted-foreground font-mono">
                        {tempBgColor || 'Theme Default'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Text Color Wheel */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-fd-secondary/60 border border-fd-border">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tempTextColor || '#000000'}
                      onChange={(e) => setTempTextColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                    />
                    <div>
                      <p className="text-xs font-semibold text-fd-foreground">Text Color</p>
                      <p className="text-[10px] text-fd-muted-foreground font-mono">
                        {tempTextColor || 'Theme Default'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Save Button */}
            <div className="pt-2 border-t border-fd-border">
              <button
                type="button"
                onClick={() => handleSaveCustomColors(tempBgColor, tempTextColor)}
                className="w-full py-2 rounded-xl bg-fd-primary text-fd-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Theme Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

