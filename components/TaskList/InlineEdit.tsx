import React, { useEffect, useRef, useState } from 'react';
import { Task } from '../../types';

interface InlineEditProps {
    task: Task;
    updateTask: (id: string, updates: Partial<Task>) => void;
    setEditingTaskId: (id: string | null) => void;
}

export const InlineEdit: React.FC<InlineEditProps> = ({
    task,
    updateTask,
    setEditingTaskId
}) => {
    const [val, setVal] = useState(task.title);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => { ref.current?.focus(); }, []);

    const save = () => {
        if (val.trim()) updateTask(task.id, { title: val });
        setEditingTaskId(null);
    };

    return (
        <input
            ref={ref}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') setEditingTaskId(null);
                e.stopPropagation(); // Prevent global listeners
            }}
            className="flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
        />
    );
};
