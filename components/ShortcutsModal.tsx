import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: "Navigation",
      items: [
        { k: "↑ / ↓", d: "Move Focus Up/Down" },
        { k: "PgUp/PgDn", d: "Sidebar Navigation" },
        { k: "Ctrl + ↑ / ↓", d: "Move Task Up/Down" },
        { k: "g then i", d: "Go to Inbox" },
        { k: "g then t", d: "Go to Today" },
        { k: "Cmd+K", d: "Command Palette" },
      ]
    },
    {
      title: "Creation",
      items: [
        { k: "Enter", d: "New Task" },
        { k: "Ctrl+Cmd+Enter", d: "New Subtask" },
        { k: "Cmd+Shift+V", d: "Batch Add from Clipboard" },
      ]
    },
    {
      title: "Organization",
      items: [
        { k: "Space", d: "Complete Task" },
        { k: "x", d: "Delete Task" },
        { k: "Tab", d: "Indent (Make Subtask)" },
        { k: "Shift+Tab", d: "Outdent" },
        { k: "d", d: "Set Due Date" },
        { k: "l", d: "Add Tags" },
      ]
    },
    {
      title: "Editing",
      items: [
        { k: "e", d: "Edit Title" },
        { k: "n", d: "Edit Note" },
        { k: "Cmd+O", d: "Open Links in Task" },
        { k: "Cmd+Z", d: "Undo" },
        { k: "Ctrl+Y", d: "Redo" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h3>
          <kbd className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Esc</kbd>
        </div>
        <div className="p-6 grid grid-cols-2 gap-8">
          {sections.map(section => (
            <div key={section.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{section.title}</h4>
              <div className="space-y-2">
                {section.items.map(item => (
                  <div key={item.k} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.d}</span>
                    <kbd className="font-mono text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded">{item.k}</kbd>
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