import React, { useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';

interface Toast {
  id: number;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { undo } = useTaskStore();

  const pushToast = (detail: string | { message: string, action?: { label: string, onClick: () => void } }) => {
    const id = Date.now();
    const content = typeof detail === 'string' ? { message: detail } : detail;

    setToasts(prev => [...prev, { id, ...content }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000); // Increased duration for undo chance
  };

  // Global event listener for custom toast events
  useEffect(() => {
    const handler = (e: any) => pushToast(e.detail);
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 bg-slate-900 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg shadow-xl animate-toast-in">
          <span className="text-sm font-medium">{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action?.onClick();
                setToasts(prev => prev.filter(toast => toast.id !== t.id));
              }}
              className="text-xs font-bold text-primary-400 hover:text-primary-300 uppercase tracking-wide px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Utility to dispatch toast
export const toast = (message: string, action?: { label: string, onClick: () => void }) => {
  const event = new CustomEvent('toast', { detail: action ? { message, action } : message });
  window.dispatchEvent(event);
};