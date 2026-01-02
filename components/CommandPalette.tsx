import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Archive, CheckCircle, SunMoon } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { useUIStore } from '../store/useUIStore';

interface Action {
  id: string;
  title: string;
  icon: React.ReactNode;
  shortcut?: string;
  perform: () => void;
  section: string;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { tasks, focusedId, toggleTask, deleteTask, archiveTask } = useTaskStore();
  const setQuickAddOpen = useUIStore((state) => state.setQuickAddOpen);

  const actions: Action[] = [
    {
      id: 'new-task',
      title: 'Create New Task',
      icon: <Plus className="w-4 h-4" />,
      shortcut: 'N',
      perform: () => {
        setQuickAddOpen(true);
      },
      section: 'Actions'
    },
    {
      id: 'toggle-theme',
      title: 'Toggle Dark/Light Mode',
      icon: <SunMoon className="w-4 h-4" />,
      perform: () => document.documentElement.classList.toggle('dark'),
      section: 'Preferences'
    }
  ];

  // Contextual Actions (based on focused task)
  if (focusedId) {
    const task = tasks.find(t => t.id === focusedId);
    if (task) {
      actions.unshift({
        id: 'toggle-task',
        title: task.completed ? 'Mark as Incomplete' : 'Mark as Complete',
        icon: <CheckCircle className="w-4 h-4" />,
        shortcut: 'X',
        perform: () => toggleTask(focusedId),
        section: 'Selected Task'
      });
      actions.unshift({
        id: 'archive-task',
        title: 'Archive Task',
        icon: <Archive className="w-4 h-4" />,
        // shortcut: 'E', // Conflict with Edit Title
        perform: () => archiveTask(focusedId),
        section: 'Selected Task'
      });
      actions.unshift({
        id: 'delete-task',
        title: 'Delete Task',
        icon: <Trash2 className="w-4 h-4" />,
        shortcut: 'Delete',
        perform: () => deleteTask(focusedId),
        section: 'Selected Task'
      });
    }
  }

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredActions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredActions[selectedIndex]?.perform();
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/20 dark:bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Esc</kbd>
        </div>

        <div className="overflow-y-auto py-2">
          {filteredActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">No results found</div>
          ) : (
            filteredActions.map((action, index) => (
              <div
                key={action.id}
                onClick={() => { action.perform(); onClose(); }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-2.5 mx-2 flex items-center gap-3 rounded-lg cursor-pointer transition-colors ${index === selectedIndex ? 'bg-slate-100 dark:bg-primary-600/10 text-primary-600 dark:text-primary-100' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                <div className={`${index === selectedIndex ? 'text-primary-500 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {action.icon}
                </div>
                <div className="flex-1 text-sm font-medium">{action.title}</div>
                {action.shortcut && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{action.section}</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 font-mono">
                      {action.shortcut}
                    </kbd>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};