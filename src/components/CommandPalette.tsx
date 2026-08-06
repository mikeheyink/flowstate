import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2, CheckCircle, SunMoon, Calendar, CalendarClock, Star, Zap, Edit3, Undo, Redo, ClipboardList, Flame, Compass, LayoutGrid, Mountain, Sprout } from 'lucide-react';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useAdventureStore } from '../store/useAdventureStore';
import { useUIStore } from '../store/useUIStore';
import { getHotkeyById } from '../utils/hotkeys';
import { getCreationDefaults, filterTodayQuad } from '../utils/taskSort';
import { QUADRANTS } from '../utils/quad';
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
  const { currentView, filter, setCurrentView, setQuickAddOpen, setEditingTaskId, setFocusMode, openNewHabit } = useUIStore();
  const { tasks, focusedId, setFocusedId, toggleTask, archiveTask, toggleUrgent, toggleImportant, undo, redo, pushTodayToTomorrow } = useTaskStore();

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

        // Eisenhower flags — manual, independent of due date.
        actions.push({
          id: 'toggle-urgent',
          title: task.urgent ? 'Unmark Urgent' : 'Mark Urgent',
          icon: <Zap className="w-4 h-4" />,
          shortcut: getHotkeyById('toggle-urgent')?.keys,
          perform: () => toggleUrgent(focusedId),
          section: 'Task'
        });
        actions.push({
          id: 'toggle-important',
          title: task.important ? 'Unmark Important' : 'Mark Important',
          icon: <Star className="w-4 h-4" />,
          shortcut: getHotkeyById('toggle-important')?.keys,
          perform: () => toggleImportant(focusedId),
          section: 'Task'
        });

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

    // === TODAY BOARD — jump straight to a quadrant.
    // Same targets as the 1–4 keys: the quadrant's first task, or the quadrant
    // itself when it's empty (where ↩ then adds a task with its flags).
    if (filter === 'today') {
      const quadGroups = filterTodayQuad(tasks);
      QUADRANTS.forEach(q => {
        const items = quadGroups[q.key];
        actions.push({
          id: `jump-${q.key}`,
          title: `Jump to ${q.title}`,
          icon: <LayoutGrid className="w-4 h-4" />,
          shortcut: q.hotkey,
          perform: () => {
            setFocusMode('main');
            setFocusedId(items[0]?.id ?? q.headerId);
          },
          section: 'Today board'
        });
      });
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

    // Create new task — mirror the Enter-key behavior: land next to the focused
    // row and inherit the view's context (due today in Today, the focused row's
    // day in Upcoming, plus its importance) instead of opening context-free.
    actions.push({
      id: 'new-task',
      title: 'New Task',
      icon: <Plus className="w-4 h-4" />,
      shortcut: getHotkeyById('new-task')?.keys,
      perform: () => {
        const focusedTask = focusedId ? tasks.find(t => t.id === focusedId) ?? null : null;
        const defaults = getCreationDefaults(filter, focusedTask);
        setQuickAddOpen(true, focusedTask?.parentId ?? null, 'create', focusedTask?.id ?? null, defaults);
      },
      section: 'Create'
    });

  } else if (currentView === 'habits') {
    // === HABIT VIEW ACTIONS ===
    actions.push({
      id: 'habit-add',
      title: 'Add Habit',
      icon: <Plus className="w-4 h-4" />,
      shortcut: getHotkeyById('habit-add')?.keys,
      perform: () => openNewHabit(),
      section: 'Habits'
    });
  } else if (currentView === 'adventure') {
    // === ADVENTURE VIEW ACTIONS ===
    actions.push({
      id: 'adventure-seed',
      title: 'New Adventure',
      icon: <Sprout className="w-4 h-4" />,
      shortcut: '↵',
      perform: () => useAdventureStore.getState().addAdventure(),
      section: 'Adventure'
    });
  }

  // === GO TO (all views) — section navigation, the current one omitted.
  // ⌘[ / ⌘] cycle sections; with two sections the "other" one is one keypress away.
  if (currentView !== 'tasks') {
    actions.push({
      id: 'go-tasks',
      title: 'Go to Tasks',
      icon: <ClipboardList className="w-4 h-4" />,
      shortcut: '⌘[',
      perform: () => setCurrentView('tasks'),
      section: 'Go to'
    });
  }
  if (currentView !== 'habits') {
    actions.push({
      id: 'go-habits',
      title: 'Go to Habits',
      icon: <Flame className="w-4 h-4" />,
      shortcut: 'g h',
      perform: () => setCurrentView('habits'),
      section: 'Go to'
    });
  }
  if (currentView !== 'objectives') {
    actions.push({
      id: 'go-objectives',
      title: 'Go to Objectives',
      icon: <Compass className="w-4 h-4" />,
      shortcut: 'g o',
      perform: () => setCurrentView('objectives'),
      section: 'Go to'
    });
  }
  if (currentView !== 'adventure') {
    actions.push({
      id: 'go-adventure',
      title: 'Go to Adventure',
      icon: <Mountain className="w-4 h-4" />,
      shortcut: 'g a',
      perform: () => setCurrentView('adventure'),
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
        // `% 0` is NaN — with no results there's nothing to move between.
        if (filteredActions.length === 0) return;
        setSelectedIndex(prev => (prev + 1) % filteredActions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredActions.length === 0) return;
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