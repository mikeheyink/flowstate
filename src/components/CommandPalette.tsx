import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2, CheckCircle, SunMoon, MessageCircle, Calendar, CalendarClock, Star, StarOff, Edit3, Undo, Redo, ClipboardList, Mail, Flame } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useUIStore } from '../store/useUIStore';
import { useCoachStore } from '../store/useCoachStore';
import { getHotkeyById } from '../utils/hotkeys';
import { toast } from './Toaster';

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
  const { currentView, filter, setCurrentView, setQuickAddOpen, setEditingTaskId, requestNewHabit } = useUIStore();
  const { tasks, focusedId, toggleTask, archiveTask, toggleImportance, clearImportance, undo, redo, pushTodayToTomorrow } = useTaskStore();
  const setCoachOpen = useCoachStore((state) => state.setOpen);

  // Build actions list - context-dependent
  const actions: Action[] = [];

  if (currentView === 'tasks') {
    // === TASK VIEW ACTIONS ===

    // Contextual Actions (when task is focused)
    if (focusedId) {
      const task = tasks.find(t => t.id === focusedId);
      if (task) {
        actions.push({
          id: 'edit-title',
          title: 'Edit Title',
          icon: <Edit3 className="w-4 h-4" />,
          shortcut: getHotkeyById('edit-title')?.keys,
          perform: () => setEditingTaskId(focusedId),
          section: 'Task'
        });

        actions.push({
          id: 'toggle-task',
          title: task.completed ? 'Mark Incomplete' : 'Mark Complete',
          icon: <CheckCircle className="w-4 h-4" />,
          shortcut: getHotkeyById('complete')?.keys,
          perform: () => toggleTask(focusedId),
          section: 'Task'
        });

        actions.push({
          id: 'set-date',
          title: 'Set Due Date',
          icon: <Calendar className="w-4 h-4" />,
          shortcut: getHotkeyById('set-date')?.keys,
          perform: () => setQuickAddOpen(true, null, 'date', focusedId),
          section: 'Task'
        });

        if (task.dueDate) {
          if (!task.importantOrder) {
            actions.push({
              id: 'toggle-importance',
              title: 'Mark Important',
              icon: <Star className="w-4 h-4" />,
              shortcut: getHotkeyById('toggle-importance')?.keys,
              perform: () => toggleImportance(focusedId),
              section: 'Task'
            });
          } else {
            actions.push({
              id: 'clear-importance',
              title: 'Unmark Important',
              icon: <StarOff className="w-4 h-4" />,
              shortcut: getHotkeyById('clear-importance')?.keys,
              perform: () => clearImportance(focusedId),
              section: 'Task'
            });
          }
        }

        actions.push({
          id: 'delete-task',
          title: 'Delete Task',
          icon: <Trash2 className="w-4 h-4" />,
          shortcut: getHotkeyById('delete')?.keys,
          perform: () => archiveTask(focusedId),
          section: 'Task'
        });
      }
    }

    // Bulk reschedule
    if (filter !== 'review') {
      actions.push({
        id: 'push-tomorrow',
        title: "Push Today's Tasks to Tomorrow",
        icon: <CalendarClock className="w-4 h-4" />,
        shortcut: getHotkeyById('push-tomorrow')?.keys,
        perform: () => {
          const n = pushTodayToTomorrow();
          toast(n > 0 ? `Moved ${n} task${n === 1 ? '' : 's'} to tomorrow` : 'Nothing due today to move');
        },
        section: 'Tasks'
      });
    }

    // Create new task
    actions.push({
      id: 'new-task',
      title: 'New Task',
      icon: <Plus className="w-4 h-4" />,
      shortcut: getHotkeyById('new-task')?.keys,
      perform: () => setQuickAddOpen(true),
      section: 'Create'
    });

    actions.push({
      id: 'review-coach',
      title: 'Review with Coach',
      icon: <MessageCircle className="w-4 h-4" />,
      perform: () => setCoachOpen(true),
      section: 'Tools'
    });

  } else if (currentView === 'habits') {
    // === HABIT VIEW ACTIONS ===
    actions.push({
      id: 'habit-add',
      title: 'Add Habit',
      icon: <Plus className="w-4 h-4" />,
      shortcut: getHotkeyById('habit-add')?.keys,
      perform: () => requestNewHabit(),
      section: 'Habits'
    });
  }

  // === GO TO (all views) — section navigation, the current one omitted ===
  if (currentView !== 'tasks') {
    actions.push({
      id: 'go-tasks',
      title: 'Go to Tasks',
      icon: <ClipboardList className="w-4 h-4" />,
      shortcut: getHotkeyById('go-tasks')?.keys,
      perform: () => setCurrentView('tasks'),
      section: 'Go to'
    });
  }
  if (currentView !== 'mail') {
    actions.push({
      id: 'go-mail',
      title: 'Go to Mail',
      icon: <Mail className="w-4 h-4" />,
      shortcut: getHotkeyById('go-mail')?.keys,
      perform: () => setCurrentView('mail'),
      section: 'Go to'
    });
  }
  if (currentView !== 'habits') {
    actions.push({
      id: 'go-habits',
      title: 'Go to Habits',
      icon: <Flame className="w-4 h-4" />,
      shortcut: getHotkeyById('go-habits')?.keys,
      perform: () => setCurrentView('habits'),
      section: 'Go to'
    });
  }

  // === GLOBAL ACTIONS (all views) ===
  actions.push({
    id: 'undo',
    title: 'Undo',
    icon: <Undo className="w-4 h-4" />,
    shortcut: getHotkeyById('undo')?.keys,
    perform: () => undo(),
    section: 'Edit'
  });

  actions.push({
    id: 'redo',
    title: 'Redo',
    icon: <Redo className="w-4 h-4" />,
    shortcut: getHotkeyById('redo')?.keys,
    perform: () => redo(),
    section: 'Edit'
  });

  actions.push({
    id: 'toggle-theme',
    title: 'Toggle Dark Mode',
    icon: <SunMoon className="w-4 h-4" />,
    perform: () => document.documentElement.classList.toggle('dark'),
    section: 'Settings'
  });

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
            placeholder="Type a command..."
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
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 font-mono">
                    {action.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};