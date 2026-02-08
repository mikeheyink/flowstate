import React, { useState, useEffect, useMemo } from 'react';
import type { Email } from '../../store/useMailStore';

export interface Contact {
    name: string;
    email: string;
    count: number;
}

const MAX_SUGGESTIONS = 5;

/** Derives a deduplicated, frequency-sorted contact list from existing emails. */
export function deriveContacts(emails: Email[]): Contact[] {
    const map = new Map<string, { name: string; count: number }>();
    for (const email of emails) {
        const key = email.senderEmail.toLowerCase();
        const existing = map.get(key);
        if (existing) {
            existing.count++;
        } else {
            map.set(key, { name: email.senderName, count: 1 });
        }
    }
    return Array.from(map.entries())
        .map(([email, { name, count }]) => ({ name, email, count }))
        .sort((a, b) => b.count - a.count);
}

interface ContactAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    contacts: Contact[];
    placeholder?: string;
    inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const ContactAutocomplete = ({
    value,
    onChange,
    contacts,
    placeholder,
    inputRef,
}: ContactAutocompleteProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Multi-recipient: only search on the text after the last comma
    const lastCommaIndex = value.lastIndexOf(',');
    const currentQuery = (lastCommaIndex === -1 ? value : value.slice(lastCommaIndex + 1))
        .trim()
        .toLowerCase();

    const matches = useMemo(() => {
        if (currentQuery.length === 0) return [];
        return contacts
            .filter(c =>
                c.name.toLowerCase().includes(currentQuery) ||
                c.email.toLowerCase().includes(currentQuery)
            )
            .slice(0, MAX_SUGGESTIONS);
    }, [contacts, currentQuery]);

    const showDropdown = isOpen && matches.length > 0;

    useEffect(() => {
        setHighlightedIndex(0);
    }, [currentQuery]);

    const selectContact = (contact: Contact) => {
        // Preserve existing recipients, append the new one with trailing comma+space
        const prefix = lastCommaIndex === -1 ? '' : value.slice(0, lastCommaIndex + 1) + ' ';
        onChange(prefix + contact.email + ', ');
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, matches.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                // Let Cmd+Enter bubble through to the send handler
                if (!e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    selectContact(matches[highlightedIndex]);
                }
                break;
            case 'Escape':
                // Close dropdown only — stop propagation so the modal doesn't also close
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
                break;
        }
    };

    return (
        <div className="relative flex-1">
            <input
                ref={inputRef}
                value={value}
                onChange={e => { onChange(e.target.value); setIsOpen(true); }}
                onFocus={() => { if (currentQuery.length > 0) setIsOpen(true); }}
                onBlur={() => setIsOpen(false)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                placeholder={placeholder}
            />
            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-10">
                    {matches.map((contact, index) => (
                        <button
                            key={contact.email}
                            type="button"
                            tabIndex={-1}
                            onMouseDown={e => { e.preventDefault(); selectContact(contact); }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-baseline gap-2 transition-colors ${
                                index === highlightedIndex
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                    : ''
                            }`}
                        >
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                {contact.name}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-xs truncate">
                                {contact.email}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
