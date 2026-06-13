import confetti from 'canvas-confetti';

/**
 * A single, small, fast confetti burst — reserved for genuine milestones
 * (closing the Today ring / clearing the inbox), never per-task. Rarity is
 * what makes it land. Uses the signature success green + brand violet, and
 * respects prefers-reduced-motion.
 */
export function celebrate() {
    confetti({
        particleCount: 45,
        spread: 65,
        startVelocity: 32,
        gravity: 1.15,
        scalar: 0.8,
        ticks: 110,
        origin: { y: 0.72 },
        colors: ['#15A66A', '#2BC98A', '#3F6896', '#5680B0'],
        disableForReducedMotion: true,
    });
}
