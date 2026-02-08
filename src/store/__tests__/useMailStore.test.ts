import { describe, it, expect, beforeEach } from 'vitest';
import { useMailStore } from '../useMailStore';
import { act } from '@testing-library/react';

// Helper to reset store between tests
const getCleanStore = () => {
    // Reset the store to initial state
    useMailStore.setState({
        emails: [],
        selectedId: null,
        focusedIndex: 0,
        activeTab: 'inbox',
        tabHistory: {},
        isLoading: false,
        error: null,
        isReadingPaneOpen: false,
    });
    return useMailStore.getState();
};

describe('useMailStore', () => {
    beforeEach(() => {
        getCleanStore();
    });

    describe('Reading Pane State', () => {
        it('should toggle reading pane state', () => {
            const store = useMailStore.getState();

            expect(store.isReadingPaneOpen).toBe(false);

            act(() => {
                store.setReadingPaneOpen(true);
            });

            expect(useMailStore.getState().isReadingPaneOpen).toBe(true);

            act(() => {
                store.setReadingPaneOpen(false);
            });

            expect(useMailStore.getState().isReadingPaneOpen).toBe(false);
        });

        it('should reset reading pane state when changing tabs', () => {
            const store = useMailStore.getState();

            act(() => {
                store.setReadingPaneOpen(true);
            });

            expect(useMailStore.getState().isReadingPaneOpen).toBe(true);

            act(() => {
                store.setActiveTab('to_read');
            });

            expect(useMailStore.getState().isReadingPaneOpen).toBe(false);
            expect(useMailStore.getState().activeTab).toBe('to_read');
        });
    });

    describe('Selection & Interaction', () => {
        it('should update selectedId and tab history', () => {
            const store = useMailStore.getState();
            const testId = 'test-id-123';

            act(() => {
                store.setSelectedId(testId);
            });

            const state = useMailStore.getState();
            expect(state.selectedId).toBe(testId);
            expect(state.tabHistory['inbox']).toBe(testId);
        });

        it('should navigate and maintain selection', () => {
            const store = useMailStore.getState();
            const testId = 'test-id-nav';

            act(() => {
                store.navigateEmail(1, testId);
            });

            const state = useMailStore.getState();
            expect(state.focusedIndex).toBe(1);
            expect(state.selectedId).toBe(testId);
            expect(state.tabHistory['inbox']).toBe(testId);
        });
    });
});
