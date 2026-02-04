# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router pages, layouts, and route handlers.
- `components/` holds shared UI components and layout pieces.
- `lib/` provides API clients, contexts (theme/user/timezone), config, and shared types.
- `public/` hosts static assets.
- `messages/` and `i18n/` contain localization resources and configuration.
- `specs/` includes backend/API reference docs.
- `tests/` exists but currently only has placeholders (`tests/temp`).

## Build, Test, and Development Commands
- `npm run dev` starts the local Next.js dev server.
- `npm run build` generates a production build.
- `npm run start` serves the production build locally.
- `npm run lint` runs ESLint (see `eslint.config.mjs`).
- `npm run typecheck` runs TypeScript without emitting files.

## Coding Style & Naming Conventions
- TypeScript/React code uses single quotes and semicolons; follow existing file formatting.
- Indentation varies across files; preserve the current file’s style when editing.
- Use the `@/` path alias for imports (configured in `tsconfig.json`).
- Components are PascalCase and live under `components/` or `app/` route folders.

## Testing Guidelines
- No automated test runner is configured in `package.json`.
- If you add tests, place them under `tests/` and document how to run them in this file.

## Commit & Pull Request Guidelines
- Recent commit history follows a simple convention: `feat: ...`, `refactor: ...`.
- Use concise, descriptive commit messages following the same `type: summary` style.
- For PRs, include a short summary and list any manual checks. Add screenshots for UI changes.

## Configuration Notes
- Environment files such as `.env.local` or `.env.docker` are used for local/dev setups.
- Docker builds copy `.env.example` to `.env`; keep `.env.example` current.
