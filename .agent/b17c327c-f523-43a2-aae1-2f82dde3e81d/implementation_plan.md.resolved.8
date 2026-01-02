# Library Table Refactor Plan

This plan outlines the refactoring of the ingredients and recipe lists from a card-based grid to a compact, minimalist table format.

## Proposed Changes

### [Styles] [index.css](file:///c:/Users/mheyi/HeyinkMeals/src/index.css)
- Add minimalist table utility classes:
    - `.zen-table-container`: Outer wrapper with border and rounded corners.
    - `.zen-table`: Basic table layout.
    - `.zen-table-header`: Stylized header row.
    - `.zen-table-row`: Hover animations and bottom borders.
    - `.zen-table-cell`: Standardized padding and typography.

### [Component] [IngredientsPage.tsx](file:///c:/Users/mheyi/HeyinkMeals/src/pages/pantry/IngredientsPage.tsx)
- Replace the ingredient `grid` with the new `zen-table` structure.
- **Columns**:
    - **Name**: Main identifier.
    - **Category**: Displayed as a badge or clean text.
    - **Store**: Displayed as a badge or clean text.
    - **Actions**: Edit and Delete icons, visible on row hover or always (depending on UX feel).
- Maintain inline editing capability within the table row.

### [Component] [RecipeListPage.tsx](file:///c:/Users/mheyi/HeyinkMeals/src/pages/recipes/RecipeListPage.tsx)
- Replace the recipe `grid` with the new `zen-table` structure.
- **Columns**:
    - **Recipe Name**: Bolded, clickable to navigate.
    - **Servings**: Numeric value with icon.
    - **Time**: Cook time (if available).
    - **Source**: Web source (if available).
- Rows should be fully clickable for navigation.

## Verification Plan

### Manual Verification
- **Visuals**: Ensure the tables look compact and fit the Zen Minimal theme (refined typography, subtle borders).
- **Interactions**:
    - Verify row hover effects make the list feel alive.
    - Test ingredient editing within the table row (forms should fit cleanly into cells).
    - Test navigation to recipes by clicking a table row.
- **Responsiveness**: Ensure tables handle different screen widths gracefully (scrolling on mobile if needed).

## Bug Fixes

### [Component] [RecipeListPage.tsx](file:///c:/Users/mheyi/HeyinkMeals/src/pages/recipes/RecipeListPage.tsx)
- **Safe URL Parsing**: Implement a helper to safely extract the domain name from `web_source`. The current `new URL()` call throws if the string is not a valid URL (e.g., missing protocol).
  ```typescript
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0].replace('www.', '');
    }
  };
  ```

## Data Cleanup and Seeding

This phase involves clearing out the existing recipe and ingredient data while preserving the core category structure and specific placeholder items.

### Cleanup Process
- **Tables to Clear**: `shopping_list_items`, `meal_plan_entries`, `grocery_list_items`, `recipes`, `grocery_lists`, `stores`.
- **`grocery_types`**: Delete all entries *except* those with names "Take-away" or "Eating out".
- **`grocery_categories`**: Preserve all entries.

### Seed Data (5 Recipes)
- **Toddler Recipes (3)**:
    1.  **Mini Turkey & Veggie Meatballs**: Soft, nutritious, and easy to grab.
    2.  **Cheesy Cauliflower Pasta**: Classic mac with blended cauliflower sauce.
    3.  **Banana Oat Pancakes**: Simple, healthy 3-ingredient breakfast or snack.
- **Parent Recipes (2)**:
    1.  **Garlic Butter Shrimp Scampi**: Fast, elegant, and protein-rich.
    2.  **Spicy Peanut Noodle Stir-fry**: Bold, aromatic, and satisfying.

## Verification
- Verify that the Recipes and Ingredients pages are empty (except for preserved items).
- Verify the 5 new recipes appear correctly in the Recipe library with their ingredients.

## Shopping List Organization Refinement

This phase improves the shopping list UI by splitting completed items into "In Stock" and "Ordered" sections, with expand/collapse capability.

### Proposed Changes

#### [Component] [ShoppingListPage.tsx](file:///c:/Users/mheyi/HeyinkMeals/src/pages/planner/ShoppingListPage.tsx)
- **Split "Secured" items**:
    - `inStockItems`: Items where `is_in_stock` is true.
    - `orderedItems`: Items where `is_purchased` is true.
- **Section Toggles**:
    - Add `useState` for `isInStockExpanded` and `isOrderedExpanded` (default to collapsed or expanded based on UX feel, possibly collapsed for brevity).
- **UI Updates**:
    - Replace the single "Secured" section with two distinct sections.
    - Add clickable headers with `ChevronDown` / `ChevronRight` icons.
    - Maintain category grouping within these collapsible sections.

## Verification Plan

### Manual Verification
- **Visuals**: Verify the two new sections appear clearly below the active list.
- **Interactions**:
    - Test expanding and collapsing each section.
    - Verify that marking an item as "In Stock" moves it to the "In Stock" section.
    - Verify that marking an item as "Purchased" moves it to the "Ordered" section.
    - Test the "Restore" button to move items back to the active list.

## Cooking Terminal Refactor

Redesign the Cooking page to mirror the structural intensity of the Planner while optimizing for a focused, "hands-free" execution environment.

### Proposed Changes

#### [Component] [CookingPage.tsx](file:///c:/Users/mheyi/HeyinkMeals/src/pages/cooking/CookingPage.tsx)
- **Structural Parity**:
    - Implement the exact same dual-header grid system (Diner Type + Meal Slot).
    - Read configuration from the shared `planner_config_v3` localStorage key.
- **Range & Context**:
    - Default to a focused 3-day view (Yesterday, Today, Tomorrow) to provide context without overwhelm.
    - Highlight "Today" with a distinct background or border (e.g., `bg-accent/5`).
- **Genius UI/UX Optimizations**:
    - **Read-Only Grid**: All slots are non-interactive by default (no selectors or "+" buttons).
    - **Focused Action**: Only slots with a planned recipe display the "Start Cooking" interaction.
    - **High-Ergonomic Buttons**: Re-imagine the "Recipe Selection" as a large, high-contrast action area or "Start" button, optimized for quick interaction in a kitchen setting.
    - **Progressive Disclosure**: Detailed recipe metadata (time, calories, etc.) is secondary to the "Start" action.

## Verification Plan

### Manual Verification
- **Structural Check**: Verify that the grid matches the Diner Types and Slots defined in the Planner's customization menu.
- **Read-Only Verification**: Confirm that clicking empty slots or attempting to change recipes is disabled.
- **Workflow Test**: Click "Start Cooking" on a planned meal and verify it navigates correctly to the cooking mode for that specific meal.
- **Visual Distinction**: Ensure "Today" stands out clearly from surrounding days.
