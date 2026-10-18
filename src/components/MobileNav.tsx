import React from 'react';
import { useUIStore } from '../store/useUIStore';
import { useTaskStore } from '../store/useTaskStore';
import { SECTIONS, SectionId, goTo } from '../utils/navigation';

// Bottom tab bar — the mobile navigation anchor. It mirrors the desktop
// section switcher exactly (same sections, same order); each section's tabs
// (Today / Plan / …, Session / Plan, …) sit in the header, like the desktop
// centre pills. Hidden on md+ (`md:hidden`) so desktop is untouched.
export function MobileNav() {
    const currentView = useUIStore((s) => s.currentView);

    const go = (id: SectionId) => {
        goTo(id);
        // Deselect when switching sections so the FAB / keyboard context resets.
        useTaskStore.getState().setFocusedId(null);
    };

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch
                       bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
                       border-t border-slate-200 dark:border-slate-800
                       pb-[env(safe-area-inset-bottom)]"
            aria-label="Primary"
        >
            {SECTIONS.map(({ id, label, Icon }) => {
                const active = currentView === id;
                return (
                    <button
                        key={id}
                        onClick={() => go(id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
                            active
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-slate-400 dark:text-slate-500 active:text-slate-600 dark:active:text-slate-300'
                        }`}
                    >
                        <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                        <span className="text-[11px] font-medium leading-none">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
