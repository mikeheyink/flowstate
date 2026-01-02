import React, { useState, useEffect, useRef } from 'react';
import { CornerDownLeft, GitMerge, Clock, Tag, CornerDownRight } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { useUIStore } from '../store/useUIStore';
import { parseTaskInput } from '../utils/nlp';

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickAdd: React.FC<QuickAddProps> = ({ isOpen, onClose }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const tasks = useTaskStore((state) => state.tasks);
  const selectedIds = useTaskStore((state) => state.selectedIds);
  const batchSetDueDate = useTaskStore((state) => state.batchSetDueDate);

  const quickAddParentId = useUIStore((state) => state.quickAddParentId);
  const quickAddMode = useUIStore((state) => state.quickAddMode);
  const quickAddTaskId = useUIStore((state) => state.quickAddTaskId);
  const setQuickAddOpen = useUIStore((state) => state.setQuickAddOpen);

  // Get contexts
  const parentTask = quickAddParentId ? tasks.find(t => t.id === quickAddParentId) : null;
  const targetTask = quickAddTaskId ? tasks.find(t => t.id === quickAddTaskId) : null;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setValue('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    if (quickAddMode === 'create') {
      // If quickAddTaskId is present in 'create' mode, it is the 'insertAfter' task ID.
      addTask(value, quickAddParentId, quickAddTaskId);
    } else if (quickAddMode === 'date') {
      // Parse only date/time from input
      const { dueDate } = parseTaskInput(value);
      if (dueDate) {
        // If multiple tasks are selected, apply to all; otherwise apply to single target
        if (selectedIds.length > 1) {
          batchSetDueDate(dueDate);
        } else if (targetTask) {
          updateTask(targetTask.id, { dueDate });
        }
      }
    } else if (quickAddMode === 'tag' && targetTask) {
      // Parse only tags
      const { tags } = parseTaskInput(value);
      if (tags.length > 0) {
        updateTask(targetTask.id, { tags: [...targetTask.tags, ...tags] });
      }
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const getPlaceholder = () => {
    if (quickAddMode === 'date') return "Type a date (e.g., 'Friday 2pm', 'in 3 days')...";
    if (quickAddMode === 'tag') return "Type tags (e.g., '#work #urgent')...";
    if (parentTask) return `Subtask for: ${parentTask.title}...`;
    return "Email Sarah tomorrow #work !1...";
  }

  const getIcon = () => {
    if (quickAddMode === 'date') return <Clock className="w-5 h-5 text-blue-400" />;
    if (quickAddMode === 'tag') return <Tag className="w-5 h-5 text-green-400" />;
    if (parentTask) return <GitMerge className="w-5 h-5 text-primary-400" />;
    return null;
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl transform transition-all animate-in zoom-in-95 slide-in-from-bottom-2 duration-200"
      >
        <form onSubmit={handleSubmit} className="relative group shadow-2xl rounded-xl">
          {getIcon() && (
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              {getIcon()}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            enterKeyHint="done"
            className={`
              w-full py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 shadow-2xl shadow-primary-900/10 dark:shadow-primary-900/20 outline-none text-lg font-medium transition-all
              ${getIcon() ? 'pl-12' : 'pl-5'} pr-12
            `}
          />
          <div className="absolute inset-y-0 right-4 flex items-center gap-2">
            {/* Indent / Outdent Controls */}
            {quickAddMode === 'create' && (
              <div className="flex items-center gap-1 mr-2 border-r border-slate-200 dark:border-slate-700 pr-2">
                <button
                  type="button"
                  onClick={() => {
                    // Outdent: Go to grandparent
                    if (parentTask) {
                      setQuickAddOpen(true, parentTask.parentId || null, 'create', quickAddTaskId);
                    }
                  }}
                  disabled={!parentTask}
                  className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${!parentTask ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}
                  title="Outdent"
                >
                  <CornerDownLeft className="w-5 h-5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Indent: Find last sibling to use as new parent
                    const siblings = tasks.filter(t => t.parentId === quickAddParentId && !t.archived && !t.completed);
                    siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    const lastSibling = siblings[siblings.length - 1];
                    if (lastSibling) {
                      setQuickAddOpen(true, lastSibling.id, 'create', quickAddTaskId);
                    }
                  }}
                  disabled={tasks.filter(t => t.parentId === quickAddParentId).length === 0}
                  className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${tasks.filter(t => t.parentId === quickAddParentId).length === 0 ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}
                  title="Indent"
                >
                  <CornerDownRight className="w-5 h-5" />
                </button>
              </div>
            )}
            {/* Mobile / Active Submit Button */}
            {(value.trim().length > 0) && (
              <button
                type="submit"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-500 active:scale-95 transition-all"
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
            )}

            {/* Desktop Shortcut Hint (Hidden if text exists or on mobile) */}
            {value.trim().length === 0 && (
              <kbd className="hidden sm:flex items-center justify-center w-6 h-6 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                <CornerDownLeft className="w-3 h-3" />
              </kbd>
            )}
          </div>
        </form>
        {quickAddMode === 'create' && (
          <div className="mt-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {parentTask && <span className="mr-2 text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-400/10 px-1.5 py-0.5 rounded">Adding Subtask</span>}
              Try: <span className="text-slate-600 dark:text-slate-500">Call Mom</span> <span className="text-primary-600 dark:text-primary-400">next Friday</span> <span className="text-primary-600 dark:text-primary-400">#personal</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};