import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Using the images we generated (paths based on your file structure, assuming they were moved to public/backgrounds or similar)
// Since I can't move them physically, I will assume for now they are in 'public/assets/inbox_zero/'
// BUT wait, I generated them to the artifacts folder. 
// I need to instruct the user or "move" them. 
// Since I can't move to public easily without shell, I'll assume they will be served from a known path or I'll use placeholders.
// Actually, I can use the artifact paths if served? No, web app can't access artifacts.
// I will use some nice external placeholder URLs for now that match the description as a fallback, 
// OR I can try to write them to public? 
// The prompt said "I will add a bunch of images to the assets folder". 
// Let's assume there are images in `/backgrounds/` for now, or use Unsplash source as a robust fallback.

// Import local asset
// Note: Vite handles image imports by returning the resolved URL
import lakeMountain from '../assets/lake_mountain.png';

interface InboxZeroProps {
    show: boolean;
}

export function InboxZero({ show }: InboxZeroProps) {
    // We only have one image now, so no need for random selection state
    const image = lakeMountain;



    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
                >
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
                        style={{ backgroundImage: `url(${image})` }}
                    />


                </motion.div>
            )}
        </AnimatePresence>
    );
}
