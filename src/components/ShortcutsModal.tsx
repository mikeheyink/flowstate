import React from 'react';
import { getHotkeyModalGroupsByView } from '../utils/hotkeys';
import { useUIStore } from '../store/useUIStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Split a key string like "⌥⇧→" or "⌘K" into individual key caps for nicer rendering.
function splitKeys(keys: string): string[] {
  if (keys.includes(' / ')) return keys.split(' / ').flatMap((k, i) => i === 0 ? splitKeys(k) : ['/', ...splitKeys(k)]);
  const glyphs = ['⌘', '⌥', '⇧', '⌃', '↩', '⌫', '⇥', '↑', '↓', '←', '→'];
  const out: string[] = [];
  let buf = '';
  for (const ch of keys) {
    if (glyphs.includes(ch)) {
      if (buf) { out.push(buf); buf = ''; }
      out.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const currentView = useUIStore((state) => state.currentView);
  const groups = getHotkeyModalGroupsByView(currentView as 'tasks' | 'mail' | 'habits');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-7 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Keyboard shortcuts</h3>
          <kbd className="px-2.5 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Esc</kbd>
        </div>
        <div className="p-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-7">
          {groups.map(group => (
            <div key={group.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3.5">{group.title}</h4>
              <div className="space-y-2.5">
                {group.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center gap-4">
                    <span className="text-[15px] text-slate-700 dark:text-slate-300">{item.description}</span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {splitKeys(item.keys).map((k, i) => (
                        <kbd
                          key={i}
                          className="min-w-[26px] text-center font-sans text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700/60 px-2 py-1 rounded-md shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
