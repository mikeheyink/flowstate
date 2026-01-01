import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';

interface Toast {
  id: number;
  message: string;
}

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { undo, history } = useTaskStore();
  
  // We'll listen to history changes to trigger a generic "Undo available" toast
  // In a real app, we'd dispatch events, but watching history length is a quick heuristic
  // for this contained MVP.
  
  // Actually, a better way for the "Action" feedback is to expose a 'lastAction' in store, 
  // but let's simulate it with a simple event listener for now to keep store clean.
  
  useEffect(() => {
    // This is a bit of a hack for the MVP to avoid complex middleware
    // We assume any state change *could* trigger a toast if we wired it up fully.
    // For now, let's just make the "Undo" button always available if history > 0
  }, [history]);

  const pushToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };
  
  // Global event listener for custom toast events
  useEffect(() => {
    const handler = (e: any) => pushToast(e.detail);
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {history.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg shadow-xl animate-toast-in">
              <span className="text-sm font-medium">Action performed</span>
              <button 
                onClick={() => undo()}
                className="text-xs font-bold text-primary-400 hover:text-primary-300 uppercase tracking-wide px-2 py-1 rounded hover:bg-slate-800 transition-colors"
              >
                  Undo (⌘Z)
              </button>
          </div>
      )}
    </div>
  );
};

// Utility to dispatch toast
export const toast = (message: string) => {
    const event = new CustomEvent('toast', { detail: message });
    window.dispatchEvent(event);
};