import React from 'react';
import { getHotkeySections } from '../utils/hotkeys';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = getHotkeySections();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h3>
          <kbd className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Esc</kbd>
        </div>
        <div className="p-6 grid grid-cols-2 gap-8">
          {sections.map(section => (
            <div key={section.category}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{section.title}</h4>
              <div className="space-y-2">
                {section.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                    <kbd className="font-mono text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded">{item.keys}</kbd>
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