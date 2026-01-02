# Mobile Swipe-to-Complete Implementation

To achieve an "incredibly well" executed Swipe-to-Complete, we need fluid physics, rubber-banding, and color interpolation. Standard CSS scrolling is not sufficient for a premium feel.

## User Review Required
**Decision**: This implementation requires adding `framer-motion` (Standard React animation library).
*   **Why**: It handles touch gestures, velocity tracking, and spring physics (the "bouncy" feel) out of the box. Building this from scratch is error-prone and usually feels "janky".

## Proposed Design (Best Practice)
**The "Reveal" Pattern**:
Instead of the item changing color *as* it moves, best practice is commonly:
1.  **Swipe Right**: The task card slides over.
2.  **Reveal**: A green background with a Check Icon is revealed *underneath* or *behind* the card.
3.  **Threshold**:
    *   **< 30% drag**: Rubber-bands back (Cancel).
    *   **> 30% drag**: Background brightens/icon grows (Feedback).
    *   **Release**: Task snaps away or visually checks off.

## Tech Stack Changes
*   **Install**: `npm install framer-motion`

## Implementation Steps

### 1. Component Update: `TaskItem`
Refactor the Task Render loop in `TaskList.tsx` into a separate `TaskItem` component to isolate animation logic.

### 2. Interaction Logic
Wrap each task in a `<motion.div>`:
*   `drag="x"` (Horizontal drag only)
*   `dragConstraints={{ left: 0, right: 100 }}` (Limit movement)
*   `onDragEnd`: Check offset. If > threshold, trigger `toggleTask`.

### 3. Visual Feedback
*   Create a "background layer" behind the list item.
*   Interpolate color opacity based on drag distance.

## Verification
1.  Open Mobile View.
2.  Swipe a task slightly right -> It should bounce back.
3.  Swipe fully right -> It should trigger "Complete" (Toast appears, strikethrough).
