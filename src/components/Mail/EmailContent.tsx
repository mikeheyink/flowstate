import { useRef, useEffect } from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface EmailContentProps {
    html: string;
}

const BASE_STYLES = `
    :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: inherit;
        word-break: break-word;
    }
    a { color: #6366f1; text-decoration: underline; }
    a:hover { color: #4f46e5; }
    img { max-width: 100%; height: auto; }
    blockquote {
        border-left: 3px solid #e2e8f0;
        padding-left: 12px;
        margin-left: 0;
        color: #64748b;
    }
    table { border-collapse: collapse; max-width: 100%; }
    td, th { padding: 4px 8px; }
    pre { overflow-x: auto; }
`;

export function EmailContent({ html }: EmailContentProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const shadowRef = useRef<ShadowRoot | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        if (!shadowRef.current) {
            shadowRef.current = containerRef.current.attachShadow({ mode: 'open' });
        }

        const clean = DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ADD_TAGS: ['style'],
            ADD_ATTR: ['target'],
        });

        shadowRef.current.innerHTML = `<style>${BASE_STYLES}</style>${clean}`;
    }, [html]);

    return <div ref={containerRef} />;
}
