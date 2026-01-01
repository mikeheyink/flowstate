import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTaskItemProps {
    id: string;
    children: (args: {
        isDragging: boolean;
        isOver: boolean;
        attributes: any;
        listeners: any;
    }) => React.ReactNode;
}

export function SortableTaskItem({ id, children }: SortableTaskItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isOver
    } = useSortable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : 'auto',
        position: 'relative' as 'relative',
        // touchAction: 'none' removed to allow scrolling
    };

    return (
        <div ref={setNodeRef} style={style}>
            {children({ isDragging, isOver, attributes, listeners })}
        </div>
    );
}
