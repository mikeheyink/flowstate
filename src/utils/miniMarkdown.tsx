import React from 'react';

/**
 * Deliberately tiny markdown renderer — just what the Objectives detail and
 * habit "why" text use: **bold**, `- ` / `• ` bullet lists, and blank-line
 * paragraph breaks. No dependency, no HTML injection (we only ever emit text
 * nodes and <strong>), so it's safe on user-entered content.
 */

// Split a single line into text + <strong> spans on **bold** markers.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) return <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-700 dark:text-slate-200">{m[1]}</strong>;
        return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
    });
}

export function MiniMarkdown({ text, className = '' }: { text: string; className?: string }) {
    const lines = (text || '').split('\n');
    const blocks: React.ReactNode[] = [];
    let bullets: string[] = [];
    let key = 0;

    const flushBullets = () => {
        if (bullets.length === 0) return;
        const items = [...bullets];
        blocks.push(
            <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 my-1">
                {items.map((b, i) => <li key={i}>{renderInline(b, `li-${i}`)}</li>)}
            </ul>
        );
        bullets = [];
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const bulletMatch = line.match(/^\s*[-•]\s+(.*)$/);
        if (bulletMatch) {
            bullets.push(bulletMatch[1]);
            continue;
        }
        flushBullets();
        if (line.trim() === '') {
            blocks.push(<div key={`sp-${key++}`} className="h-2" />);
        } else {
            blocks.push(<p key={`p-${key++}`} className="my-0.5">{renderInline(line, `p-${key}`)}</p>);
        }
    }
    flushBullets();

    return <div className={className}>{blocks}</div>;
}
