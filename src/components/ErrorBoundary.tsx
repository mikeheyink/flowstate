import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    // Re-mount the app subtree in place. Most errors here are transient (a
    // gesture racing with a state update, a stale index), so "Try again" lets
    // the user recover without a full reload — and without the scary red wall
    // taking over the whole screen.
    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full text-center">
                        <div className="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Something hiccuped</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                            Your tasks and habits are safe. Try again, and if it keeps happening reload the app.
                        </p>
                        {this.state.error && (
                            <pre className="text-left text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-lg overflow-auto text-slate-500 dark:text-slate-400 font-mono mb-5 max-h-32">
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium transition-colors"
                            >
                                Try again
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                            >
                                Reload
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
