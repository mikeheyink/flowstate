import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Curated, high-resolution (2400px) nature backdrops shown when the inbox is cleared.
// A fresh one is picked at random each time the empty state appears.
// Auto-collected from the folder via Vite glob — just drop new .jpg files in to add more.
const IMAGES = Object.values(
    import.meta.glob('../assets/inbox_zero/*.jpg', { eager: true, import: 'default' })
) as string[];

const randomIndex = () => Math.floor(Math.random() * IMAGES.length);

interface InboxZeroProps {
    show: boolean;
}

export function InboxZero({ show }: InboxZeroProps) {
    const [index, setIndex] = useState(randomIndex);

    // Re-roll the image each time the empty state (re)appears.
    useEffect(() => {
        if (show) setIndex(randomIndex());
    }, [show]);

    const image = IMAGES[index];

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key={image}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    // z-30 keeps the calming backdrop *below* the TopNav/QuickAdd/CommandPalette (z-50+),
                    // and pointer-events-none lets clicks/keys reach them so the empty state isn't a dead-end.
                    className="fixed inset-0 z-30 flex items-center justify-center bg-black pointer-events-none"
                >
                    <motion.div
                        key={image}
                        initial={{ opacity: 0, scale: 1.04 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.6, ease: "easeOut" }}
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${image})` }}
                    />

                    {/* Scrim for text legibility across bright or busy images */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

                    <div className="relative text-center px-6">
                        <p className="font-display text-white text-4xl font-bold tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                            All tasks done
                        </p>
                        <p className="mt-3 text-white/85 text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                            Press <kbd className="px-1.5 py-0.5 mx-0.5 rounded bg-white/20 backdrop-blur-sm font-mono">Enter</kbd> to add a task
                            <span className="mx-1.5">·</span>
                            <kbd className="px-1.5 py-0.5 mx-0.5 rounded bg-white/20 backdrop-blur-sm font-mono">⌘K</kbd> for commands
                        </p>
                    </div>

                </motion.div>
            )}
        </AnimatePresence>
    );
}
