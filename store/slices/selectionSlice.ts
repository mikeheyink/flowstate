/**
 * Selection Slice
 * 
 * Manages task selection state for multi-select operations.
 * This is a Zustand slice creator pattern - returns partial state/actions.
 */

import { StateCreator } from 'zustand';

export interface SelectionSlice {
    // State
    selectedIds: string[];

    // Actions
    selectTask: (id: string, multi: boolean) => void;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
}

export const createSelectionSlice: StateCreator<
    SelectionSlice,
    [],
    [],
    SelectionSlice
> = (set) => ({
    selectedIds: [],

    selectTask: (id, multi) => set((state) => {
        if (multi) {
            if (state.selectedIds.includes(id)) return state;
            return { selectedIds: [...state.selectedIds, id] };
        }
        return { selectedIds: [id] };
    }),

    toggleSelection: (id) => set((state) => {
        if (state.selectedIds.includes(id)) {
            return { selectedIds: state.selectedIds.filter(sid => sid !== id) };
        }
        return { selectedIds: [...state.selectedIds, id] };
    }),

    clearSelection: () => set({ selectedIds: [] }),
});
