import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useObjectiveStore } from '../../store/useObjectiveStore';
import { useUIStore } from '../../store/useUIStore';
import { Objective } from '../../types';

/**
 * The Objectives page — the "why" layer. Deliberately calm and read-mostly:
 * a page you *return to*, not a dashboard. Once a day it doubles as the
 * soft-start screen (any key dismisses to Today).
 *
 * Keyboard: ↑/↓ move between objectives · E or Enter edit · Esc done ·
 * ⌘↑/⌘↓ reorder · A add.
 */

// Palette offered when adding a new objective (cycles).
const NEW_OBJECTIVE_COLORS = ['#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#6674E4'];

export function ObjectivesView() {
    const allObjectives = useObjectiveStore((s) => s.objectives);
    const updateObjective = useObjectiveStore((s) => s.updateObjective);
    const addObjective = useObjectiveStore((s) => s.addObjective);
    const removeObjective = useObjectiveStore((s) => s.removeObjective);
    const moveObjective = useObjectiveStore((s) => s.moveObjective);
    const seedIfEmpty = useObjectiveStore((s) => s.seedIfEmpty);

    const softStartActive = useUIStore((s) => s.softStartActive);
    const isAnyOverlayOpen = useUIStore((s) => s.isAnyOverlayOpen);

    const objectives = allObjectives.filter(o => !o.archivedAt).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const editingRef = useRef<string | null>(null);
    useEffect(() => { editingRef.current = editingId; }, [editingId]);

    // Guest sessions never run fetchObjectives, so seed from here too.
    useEffect(() => { seedIfEmpty(); }, [seedIfEmpty]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (softStartActive) return; // the soft-start dismiss handler owns keys
            if (isAnyOverlayOpen()) return;
            if (editingRef.current) return; // inputs own their keys while editing
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();
            const isCmd = e.metaKey || e.ctrlKey;
            const list = useObjectiveStore.getState().objectives
                .filter(o => !o.archivedAt)
                .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
            if (list.length === 0) return;

            const idx = list.findIndex(o => o.id === focusedId);

            if (key === 'arrowdown') {
                e.preventDefault();
                if (isCmd && focusedId) { moveObjective(focusedId, 'down'); return; }
                setFocusedId(list[Math.min(idx + 1, list.length - 1) < 0 ? 0 : Math.min(idx + 1, list.length - 1)].id);
            } else if (key === 'arrowup') {
                e.preventDefault();
                if (isCmd && focusedId) { moveObjective(focusedId, 'up'); return; }
                setFocusedId(list[idx <= 0 ? list.length - 1 : idx - 1].id);
            } else if ((key === 'e' || key === 'enter') && focusedId && !isCmd) {
                e.preventDefault();
                setEditingId(focusedId);
            } else if (key === 'a' && !isCmd) {
                e.preventDefault();
                addObjective('New objective', NEW_OBJECTIVE_COLORS[list.length % NEW_OBJECTIVE_COLORS.length]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedId, softStartActive, isAnyOverlayOpen, moveObjective, addObjective]);

    return (
        <div className="max-w-2xl mx-auto px-6 pb-32 pt-4">
            {/* Quiet page heading — the content is the hero, not the chrome */}
            <div className="flex items-baseline justify-between mb-10">
                <h1 className="font-display text-lg font-semibold text-slate-400 dark:text-slate-500 tracking-wide uppercase">
                    Objectives
                </h1>
                <button
                    onClick={() => addObjective('New objective', NEW_OBJECTIVE_COLORS[objectives.length % NEW_OBJECTIVE_COLORS.length])}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Add objective (A)"
                >
                    <Plus className="w-3.5 h-3.5" /> Add
                </button>
            </div>

            <div className="space-y-10">
                {objectives.map((o, i) => (
                    <ObjectiveCard
                        key={o.id}
                        objective={o}
                        index={i}
                        isFocused={focusedId === o.id}
                        isEditing={editingId === o.id}
                        onFocus={() => setFocusedId(o.id)}
                        onEdit={() => { setFocusedId(o.id); setEditingId(o.id); }}
                        onDoneEditing={() => setEditingId(null)}
                        onUpdate={(updates) => updateObjective(o.id, updates)}
                        onRemove={() => {
                            if (confirm(`Remove “${o.title}”?`)) removeObjective(o.id);
                        }}
                    />
                ))}
            </div>

            {softStartActive && (
                <div className="fixed bottom-10 left-0 right-0 text-center pointer-events-none">
                    <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">
                        Press any key to begin the day
                    </p>
                </div>
            )}

            {!softStartActive && (
                <p className="mt-14 text-center text-[11px] text-slate-300 dark:text-slate-600 font-mono">
                    ↑↓ move · E edit · ⌘↑⌘↓ reorder · A add
                </p>
            )}
        </div>
    );
}

interface ObjectiveCardProps {
    objective: Objective;
    index: number;
    isFocused: boolean;
    isEditing: boolean;
    onFocus: () => void;
    onEdit: () => void;
    onDoneEditing: () => void;
    onUpdate: (updates: Partial<Objective>) => void;
    onRemove: () => void;
}

function ObjectiveCard({ objective, index, isFocused, isEditing, onFocus, onEdit, onDoneEditing, onUpdate, onRemove }: ObjectiveCardProps) {
    const [title, setTitle] = useState(objective.title);
    const [body, setBody] = useState(objective.body);
    const titleRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            setTitle(objective.title);
            setBody(objective.body);
            setTimeout(() => titleRef.current?.focus(), 30);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    const commit = () => {
        const t = title.trim();
        onUpdate({ title: t || objective.title, body });
        onDoneEditing();
    };

    if (isEditing) {
        return (
            <div className="rounded-2xl ring-1 ring-primary-500/40 bg-white dark:bg-slate-850 p-5 -mx-5">
                <div className="flex items-center gap-3 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: objective.color }} />
                    <input
                        ref={titleRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commit(); }
                            if (e.key === 'Escape') { e.preventDefault(); commit(); }
                        }}
                        className="flex-1 bg-transparent font-display text-xl font-semibold text-slate-900 dark:text-slate-100 outline-none border-b border-slate-200 dark:border-slate-700 focus:border-primary-500 pb-1"
                    />
                </div>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') { e.preventDefault(); commit(); }
                    }}
                    rows={Math.max(3, body.split('\n').length + 1)}
                    className="w-full bg-transparent text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 outline-none resize-y"
                    placeholder="What does this mean? What will you do?"
                />
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5">
                        {['#0EA5E9', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#6674E4'].map(c => (
                            <button
                                key={c}
                                onClick={() => onUpdate({ color: c })}
                                className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${objective.color === c ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900' : ''}`}
                                style={{ backgroundColor: c }}
                                title="Set color"
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors">Remove</button>
                        <button onClick={commit} className="px-2.5 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-500 font-medium">Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <article
            onClick={onFocus}
            onDoubleClick={onEdit}
            className={`relative cursor-default rounded-2xl transition-colors -mx-5 px-5 py-3 ${isFocused ? 'bg-white dark:bg-slate-850 ring-1 ring-slate-200/70 dark:ring-slate-800' : ''}`}
            data-objective-id={objective.id}
        >
            {isFocused && (
                <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full" style={{ backgroundColor: objective.color }} />
            )}
            <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: objective.color }} />
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                    <span className="text-slate-300 dark:text-slate-600 font-normal mr-2">{index + 1}</span>
                    {objective.title}
                </h2>
            </div>
            {objective.body && (
                <p className="mt-2.5 ml-[22px] text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {objective.body}
                </p>
            )}
        </article>
    );
}
