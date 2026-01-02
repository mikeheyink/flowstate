# Spiritual Companion App - Implementation Plan

## Goal Description
Build a minimalist, beautiful web application acting as a spiritual companion inspired by secular Buddhism (Sam Harris, Joseph Goldstein). The app will help the user stay centered through daily wisdom, a meditation timer, and habit tracking for mindfulness.

## User Review Required
> [!NOTE]
> I will be using Vanilla CSS as per standard instructions for maximum design control, focusing on a "Premium Minimalist" aesthetic.

## Proposed Changes

### Project Structure
#### [NEW] Project Setup
- Initialize `vite` with `react` template.
- Clean up `App.css` and `index.css`.
- Create `src/components`, `src/hooks`, `src/data`.

### Design System
#### [NEW] [index.css](file:///src/index.css)
- Define CSS variables for colors:
    - Background: `#F9F9F7` (Warm Off-White)
    - Text: `#2C2C2C` (Soft Charcoal)
    - Accent: `#7C9082` (Sage Green)
    - Secondary: `#D3D3D3` (Soft Gray)
- Typography:
    - Headings/Quotes: 'Playfair Display' or similar Serif.
    - UI Elements: 'Inter' or 'Lato' Sans-serif.

### Features

#### [NEW] Daily Wisdom
- `src/data/quotes.js`: Collection of quotes from Sam Harris, Joseph Goldstein, and Buddhist texts.
- `src/components/DailyQuote.jsx`: Component to display a random or daily quote with elegant typography.

#### [NEW] Meditation Timer
- `src/components/MeditationTimer.jsx`: Simple countdown timer.
    - Selectable duration (5, 10, 20, 30 mins).
    - Visual progress indicator (minimalist ring or bar).
    - Soft chime sound (optional, maybe just visual for now).

#### [NEW] Mindful Habits
- `src/components/HabitTracker.jsx`:
    - List of habits (e.g., "Noting", "Metta", "Mindful Walking").
    - Simple toggle/checkbox for daily completion.
    - "Streak" visualization (minimalist dots).

### Main App
#### [MODIFY] [App.jsx](file:///src/App.jsx)
- Compose the Layout.
- Integrate `DailyQuote`, `MeditationTimer`, and `HabitTracker`.

## Verification Plan

### Automated Tests
- Run `npm run dev` and verify no console errors.

### Manual Verification
- **Design Check**: Ensure the vibe is "calm", "minimalist", and "premium".
- **Timer**: Verify countdown works and resets.
- **Habits**: Verify toggling works and state persists (using local storage for simplicity).
