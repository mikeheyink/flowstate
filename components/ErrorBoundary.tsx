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

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl border border-red-200 max-w-lg w-full">
                        <h1 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h1>
                        <pre className="text-sm bg-slate-100 p-4 rounded overflow-auto text-slate-700 font-mono">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
