import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useOutlet } from 'react-router-dom';

interface SlidingViewProps {
    children?: React.ReactNode;
}

// Determine direction based on route order
const getRouteIndex = (pathname: string): number => {
    const routes = ['/tasks', '/', '/mail'];
    const idx = routes.indexOf(pathname);
    return idx === -1 ? routes.indexOf('/') : idx;
};

export function SlidingView({ children }: SlidingViewProps) {
    const location = useLocation();
    const outlet = useOutlet();
    const currentIndex = getRouteIndex(location.pathname);

    // Track previous index for direction
    const [prevIndex, setPrevIndex] = React.useState(currentIndex);
    const direction = currentIndex > prevIndex ? 1 : -1;

    React.useEffect(() => {
        setPrevIndex(currentIndex);
    }, [currentIndex]);

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? '-100%' : '100%',
            opacity: 0,
        }),
    };

    return (
        <AnimatePresence mode="wait" custom={direction}>
            <motion.div
                key={location.pathname}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 },
                }}
                className="w-full h-full"
            >
                {children || outlet}
            </motion.div>
        </AnimatePresence>
    );
}
