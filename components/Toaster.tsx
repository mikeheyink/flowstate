import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';

interface Toast {
  id: number;
  message: string;
}

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { undo } = useTaskStore();

  // We'll listen to history changes to trigger a generic "Undo available" toast
  // In a real app, we'd dispatch events, but watching history length is a quick heuristic
  // for this contained MVP.

  // Actually, a better way for the "Action" feedback is to expose a 'lastAction' in store, 
  // but let's simulate it with a simple event listener for now to keep store clean.

  // Removed history effect as history is not yet implemented

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
      {/* 
          Undo toast temporarily disabled as history is not fully implemented in store yet.
          To re-enable, add history state to useTaskStore.
       */}
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto bg-slate-900 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg shadow-xl animate-toast-in">
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
};

// Utility to dispatch toast
export const toast = (message: string) => {
  const event = new CustomEvent('toast', { detail: message });
  window.dispatchEvent(event);
};