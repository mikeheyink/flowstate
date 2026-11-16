import React, { useEffect, useState } from 'react';

const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Digital wall clock (24 h). Ticks on the minute boundary, not every second. */
export function Clock({ className = '' }: { className?: string }) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let id: number;
        const schedule = () => {
            const d = new Date();
            id = window.setTimeout(() => { setNow(new Date()); schedule(); }, 60_000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
        };
        schedule();
        // Timers stall in background tabs and on sleeping phones: resync on return.
        const resync = () => { if (!document.hidden) setNow(new Date()); };
        document.addEventListener('visibilitychange', resync);
        return () => { window.clearTimeout(id); document.removeEventListener('visibilitychange', resync); };
    }, []);

    return (
        <time
            dateTime={now.toISOString()}
            title={now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            className={`font-mono tabular-nums text-sm font-semibold text-slate-700 dark:text-slate-200 ${className}`}
        >
            {hhmm(now)}
        </time>
    );
}
