import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Deterministic in-memory localStorage. zustand's persist middleware reaches for
// `localStorage` at store-creation time, and the happy-dom one isn't reliably
// present then — without this, any store.setState() throws "Cannot read
// properties of undefined (reading 'setItem')".
const __ls = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
        getItem: (k: string) => (__ls.has(k) ? __ls.get(k)! : null),
        setItem: (k: string, v: string) => { __ls.set(k, String(v)); },
        removeItem: (k: string) => { __ls.delete(k); },
        clear: () => { __ls.clear(); },
        key: (i: number) => [...__ls.keys()][i] ?? null,
        get length() { return __ls.size; },
    },
});

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock Supabase client globally
vi.mock('../utils/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
            signInWithOAuth: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
        }),
    },
}));

// Mock navigator.clipboard for tests
Object.defineProperty(navigator, 'clipboard', {
    value: {
        readText: vi.fn().mockResolvedValue(''),
        writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
});
