import { useEffect, useState } from 'react';

// Single source of truth for the "is this a phone-sized viewport" question.
// 768px matches Tailwind's `md` breakpoint, so JS checks and `md:` classes
// always agree. Desktop (>=768px) keeps every existing behaviour untouched.
export const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    );

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return isMobile;
}
