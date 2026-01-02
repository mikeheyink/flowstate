# Sprint 1: Data Models Implementation Plan

## Goal Description
Initialize the Grocery and Meal Planning App and establish the core data models using Prisma and SQLite. This phase focuses strictly on the backend data structure to ensure a solid foundation for the API and UI phases.

## User Review Required
> [!IMPORTANT]
> **Database Choice**: I am proposing **SQLite** for the initial development as it requires no external server setup. We can easily switch to PostgreSQL later if needed.
> **Schema Design**: Please review the proposed models below to ensure they cover your expected data requirements.

## Proposed Changes

### Project Initialization
#### [NEW] [package.json](file:///c:/Users/mheyi/HeyinkMeals/package.json)
- Initialize a new Next.js project with TypeScript.
- Install `prisma` and `@prisma/client`.

### Data Layer
#### [NEW] [schema.prisma](file:///c:/Users/mheyi/HeyinkMeals/prisma/schema.prisma)
- Define the following models:
    - **User**: `id`, `email`, `name`, `createdAt`, `updatedAt`
    - **Recipe**: `id`, `title`, `description`, `instructions`, `userId` (creator)
    - **Ingredient**: `id`, `name`, `defaultUnit`
    - **RecipeIngredient**: Join table linking Recipe and Ingredient with `quantity` and `unit`.
    - **MealPlan**: `id`, `date`, `userId`, `recipeId`, `mealType` (e.g., Breakfast, Lunch, Dinner)
    - **GroceryList**: `id`, `userId`, `name`, `status`
    - **GroceryItem**: `id`, `groceryListId`, `ingredientId` (optional), `name` (for custom items), `quantity`, `unit`, `checked`

#### [NEW] [seed.ts](file:///c:/Users/mheyi/HeyinkMeals/prisma/seed.ts)
- Create a seed script to populate the database with initial data for verification.
    - Create 1 User
    - Create 2 Ingredients (e.g., "Rice", "Chicken")
    - Create 1 Recipe using those ingredients
    - Create 1 Meal Plan entry

## Verification Plan

### Automated Tests
- **Prisma Validation**: Run `npx prisma validate` to ensure the schema is correct.
- **Migration**: Run `npx prisma migrate dev --name init` to apply the schema to the SQLite database.
- **Seeding**: Run `npx prisma db seed` (or `ts-node prisma/seed.ts`) to verify that data can be inserted and related correctly.
- **Query Check**: Create a simple script `check-data.ts` to query the seeded data and print it to the console to verify relationships (e.g., fetching a recipe includes its ingredients).
