import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface SectionHeaderProps {
    title: string;
    count?: number;
    color?: string;
    isExpanded?: boolean;
    onToggle?: () => void;
    isFocused?: boolean;
}

export function SectionHeader({ title, count, color = "text-slate-800 dark:text-slate-200", isExpanded, onToggle, isFocused }: SectionHeaderProps) {
    const Component = onToggle ? 'button' : 'div';

    return (
        <Component
            className={`
                flex items-center gap-3 py-3 px-4 w-full text-left outline-none rounded-lg transition-all
                ${onToggle ? 'cursor-pointer' : ''}
                ${isFocused
                    ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }
            `}
            onClick={onToggle}
        >
            {onToggle && (
                <div className={`transition-colors ${isFocused ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
            )}

            <h3 className={`text-base font-semibold flex-1 ${color}`}>
                {title}
            </h3>

            {count !== undefined && (
                <span className="text-sm text-slate-400 dark:text-slate-500">
                    {count} {count === 1 ? 'task' : 'tasks'}
                </span>
            )}
        </Component>
    );
}
