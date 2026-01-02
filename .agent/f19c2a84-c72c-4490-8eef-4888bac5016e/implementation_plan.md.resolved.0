# HeyinkMeals Implementation Plan

## Goal Description
Build a premium, aesthetically pleasing web application to assist the household with meal planning, shopping lists, and recipe management. The app will feature a modern "Glassmorphism" design with vibrant colors and fluid animations.

## User Review Required
> [!IMPORTANT]
> **Tech Stack Selection**: I am proposing **React + Vite** with **TypeScript** for the frontend, using **Vanilla CSS** for custom robust styling to achieve the high-end design requirements. Data will initially be persisted to **LocalStorage** for immediate utility and zero-setup, but architected to easily swap for a backend (like Supabase/Firebase) later.

## Proposed Changes

### Project Structure
#### [NEW] [Project Root]
- Initialize a new Vite project.
- Configure `eslint` and `prettier`.

### Core Architecture
#### [NEW] [src/components]
- `Layout`: Main app shell with navigation.
- `Button`, `Card`, `Input`: Reusable UI components with premium styling (glass effect, hover states).

#### [NEW] [src/pages]
- `Dashboard`: Overview of today's meals and quick actions.
- `Planner`: Drag-and-drop calendar view for scheduling meals.
- `Recipes`: Collection of recipes with filtering and "Add to Plan" functionality.
- `ShoppingList`: Auto-generated list based on the planner, with manual add/remove.

#### [NEW] [src/styles]
- `index.css`: Global variables (colors, spacing, typography) and base resets. 
- Implement a dark/light mode capable theme system from day one.

### Features
1. **Meal Planner**: Visual weekly calendar.
2. **Smart Shopping List**: Aggregates ingredients from planned meals.
3. **Recipe Vault**: Store and organize favorite recipes.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify production build success.
- Run `npm run lint` to ensure code quality.

### Manual Verification
- **Design Check**: Verify the "wow" factor (gradients, glassmorphism, animations) on the Dashboard.
- **Flow Check**: Create a recipe -> Add to plan -> Check shopping list.
