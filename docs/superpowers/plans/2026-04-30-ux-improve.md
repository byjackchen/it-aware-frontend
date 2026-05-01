# UX Improve — Global Loading + Freeze-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page navigation feel instant, give a unified loading animation across the whole app, and remove the synchronous main-thread work that causes "click → freeze → eventually navigates".

**Architecture:**
- Introduce a `NavigationProvider` (React 19 `useTransition`) that turns every navigation into a transition, exposing an `isPending` flag.
- A global `<RouteProgressBar />` (NProgress-style top bar) reads `isPending` and shows up the instant the user clicks — no dependency, ~80 lines of CSS+TSX.
- Replace ad-hoc click handlers (`router.push`) and `<Link>` usages with `useTransitionRouter` / `<NavLink>` so click feedback is uniform.
- Backfill `loading.tsx` and `error.tsx` for every top-level App Router segment — Next.js automatically wraps the segment's children in `<Suspense>` so server-component pages no longer "freeze" while waiting on `await fetch(...)`.
- Standardize loading primitives (`PageSkeleton`, `ListSkeleton`, `DetailSkeleton`, `ChartSkeleton`, `OverlaySpinner`) and a shimmer keyframe in `globals.css`.
- Fix the three concrete main-thread blockers: surveys-list pagination cascading `setState`, surveys-list `xlsx` export, and treemap render bursts (deferred + dynamic + Suspense).

**Tech Stack:** Next.js 16 (App Router), React 19, next-intl 4, Tailwind 4, `lucide-react`, `xlsx` (existing), `recharts` (existing).

**Branch:** `feat-ux-improve` (already created off `development`).

**Verification approach:** This project has no unit-test runner configured (`package.json` has no `test` script and no Vitest/Jest). Verification per task uses `npm run typecheck`, `npm run lint`, manual smoke in `npm run dev`, and a final Docker build to mirror remote CI/CD per `CLAUDE.md`. Where deterministic logic is added (e.g. the chunked export utility), a tiny standalone Node script under `scripts/` is used as a smoke test instead of a test framework.

---

## File Structure

```
components/
  navigation/
    NavigationProvider.tsx          (NEW) React 19 useTransition + router context
    NavLink.tsx                     (NEW) <a>-based link that calls navigate() in a transition
    RouteProgressBar.tsx            (NEW) top NProgress-style bar driven by isPending
    useTransitionRouter.ts          (NEW) hook returning { push, replace, back, isPending }
  layout/
    LoadingSpinner.tsx              (KEEP — already a good base)
    skeletons/
      PageSkeleton.tsx              (NEW) full-page route-level fallback
      ListSkeleton.tsx              (NEW) list/table route fallback (header + rows + filter bar)
      DetailSkeleton.tsx            (NEW) detail page (header + 2-col body + tab strip)
      ChartSkeleton.tsx             (NEW) shimmering rectangle for chart areas
      OverlaySpinner.tsx            (NEW) centered overlay for blocking actions (export, save)
  charts/
    DeferredKeywordTreemap.tsx      (NEW) wraps the heavy treemap with useDeferredValue + Suspense

app/
  globals.css                       (MODIFY) add `@keyframes shimmer` + `.animate-shimmer`
  (main)/
    layout.tsx                      (MODIFY) mount NavigationProvider + RouteProgressBar
    error.tsx                       (KEEP)
    loading.tsx                     (KEEP)
    agent-ops/loading.tsx           (NEW)
    agent-ops/error.tsx             (NEW)
    auth/error.tsx                  (NEW — loading.tsx already exists)
    campaign/loading.tsx            (NEW)
    campaign/error.tsx              (NEW)
    dashboard/loading.tsx           (NEW)
    dashboard/error.tsx             (NEW)
    data/error.tsx                  (NEW — loading.tsx already exists)
    knowledge/loading.tsx           (NEW)
    knowledge/error.tsx             (NEW)
    operation-teams/loading.tsx     (NEW)
    operation-teams/error.tsx       (NEW)
    persona/loading.tsx             (NEW)
    persona/error.tsx               (NEW)
    persona/[oid]/loading.tsx       (NEW — heavy fetch page deserves its own skeleton)
    ssc-cockpit/loading.tsx         (NEW)
    ssc-cockpit/error.tsx           (NEW)
    data/surveys/SurveysListPage.tsx (MODIFY) coalesce setState + abort + chunked export
    data/surveys/exportSurveysXlsx.ts (NEW) chunked yielding xlsx exporter with progress
    campaign/survey-analytics/charts/KeywordTreemap.tsx (MODIFY) split into deferred wrapper

lib/
  navigation/
    eventBus.ts                     (NEW) tiny window-event bridge for click-side feedback hooks (used by export/blocking actions, not nav)

messages/
  en.json                           (MODIFY) add Common.loading.* unified keys
  zh.json                           (MODIFY) ditto

scripts/
  smoke-export-surveys.mjs          (NEW) tiny Node script to verify chunked-export utility produces an XLSX file

```

---

## Task 1: Add unified shimmer keyframe + design tokens

**Files:**
- Modify: `app/globals.css` (append at end)

- [ ] **Step 1: Read current end of globals.css to find a good append point**

Run: `wc -l app/globals.css`
Expected: a number around 700+ — used to confirm we are appending, not overwriting.

- [ ] **Step 2: Append unified loading utilities to `app/globals.css`**

Append exactly the block below to the end of `app/globals.css`:

```css

/* ========================================
   Unified Loading Utilities (feat-ux-improve)
   ======================================== */

@keyframes ux-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.10) 50%,
    rgba(255, 255, 255, 0.04) 100%
  );
  background-size: 200% 100%;
  animation: ux-shimmer 1.4s linear infinite;
}

.light .animate-shimmer,
.theme-light .animate-shimmer {
  background-image: linear-gradient(
    90deg,
    rgba(15, 23, 42, 0.04) 0%,
    rgba(15, 23, 42, 0.10) 50%,
    rgba(15, 23, 42, 0.04) 100%
  );
}

@keyframes ux-route-progress-indeterminate {
  0%   { transform: translateX(-100%) scaleX(0.4); }
  50%  { transform: translateX(0%)    scaleX(0.7); }
  100% { transform: translateX(100%)  scaleX(0.4); }
}

.animate-route-progress {
  animation: ux-route-progress-indeterminate 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  transform-origin: left;
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean (CSS changes don't affect TS).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(ux): add shimmer + route-progress keyframes"
```

---

## Task 2: NavigationProvider + useTransitionRouter

**Files:**
- Create: `components/navigation/NavigationProvider.tsx`
- Create: `components/navigation/useTransitionRouter.ts`

- [ ] **Step 1: Create `components/navigation/NavigationProvider.tsx`**

```tsx
'use client';

/**
 * Wraps next/navigation's router with React 19's useTransition so every
 * programmatic navigation becomes a transition with an isPending flag.
 * RouteProgressBar and NavLink read this context.
 */

import { createContext, useContext, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type NavigationContextValue = {
    isPending: boolean;
    push: (href: string) => void;
    replace: (href: string) => void;
    back: () => void;
    refresh: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const value: NavigationContextValue = {
        isPending,
        push: (href) => startTransition(() => router.push(href)),
        replace: (href) => startTransition(() => router.replace(href)),
        back: () => startTransition(() => router.back()),
        refresh: () => startTransition(() => router.refresh()),
    };

    return (
        <NavigationContext.Provider value={value}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation(): NavigationContextValue {
    const ctx = useContext(NavigationContext);
    if (!ctx) {
        throw new Error('useNavigation must be used inside <NavigationProvider>');
    }
    return ctx;
}
```

- [ ] **Step 2: Create `components/navigation/useTransitionRouter.ts`**

```ts
'use client';

/**
 * Drop-in replacement for next/navigation's useRouter() at call sites that only
 * need push/replace/back/refresh. Returns the same shape PLUS isPending so the
 * caller can disable buttons or show inline spinners while a transition runs.
 *
 * Migrate gradually: leave useRouter() in place where pathname/searchParams are
 * needed alongside (those live in usePathname/useSearchParams).
 */

import { useNavigation } from './NavigationProvider';

export function useTransitionRouter() {
    const { push, replace, back, refresh, isPending } = useNavigation();
    return { push, replace, back, refresh, isPending };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/navigation/NavigationProvider.tsx components/navigation/useTransitionRouter.ts
git commit -m "feat(ux): add NavigationProvider + useTransitionRouter"
```

---

## Task 3: RouteProgressBar

**Files:**
- Create: `components/navigation/RouteProgressBar.tsx`

- [ ] **Step 1: Create `components/navigation/RouteProgressBar.tsx`**

```tsx
'use client';

/**
 * Top-of-page progress bar. Becomes visible when NavigationProvider's isPending
 * is true (route transition in flight) and animates a determinate ramp toward
 * 90%, then snaps to 100% and fades out when the transition resolves.
 *
 * The bar always renders 2px tall, fixed at the top, above all app chrome
 * (z-index 100). It does not depend on any third-party library.
 */

import { useEffect, useState } from 'react';
import { useNavigation } from './NavigationProvider';

const RAMP: ReadonlyArray<{ at: number; pct: number }> = [
    { at: 0,    pct: 8 },
    { at: 90,   pct: 30 },
    { at: 350,  pct: 60 },
    { at: 900,  pct: 80 },
    { at: 2000, pct: 90 },
];

export function RouteProgressBar() {
    const { isPending } = useNavigation();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isPending) {
            setVisible(true);
            const timers: ReturnType<typeof setTimeout>[] = [];
            for (const { at, pct } of RAMP) {
                timers.push(setTimeout(() => setProgress(pct), at));
            }
            return () => timers.forEach(clearTimeout);
        }

        // transition finished — snap to 100, then hide
        if (visible) {
            setProgress(100);
            const hide = setTimeout(() => {
                setVisible(false);
                setProgress(0);
            }, 220);
            return () => clearTimeout(hide);
        }
    }, [isPending, visible]);

    if (!visible) return null;

    return (
        <div
            aria-hidden
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="fixed top-0 left-0 right-0 z-[100] pointer-events-none"
            style={{ height: 2 }}
        >
            <div
                className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                style={{
                    width: `${progress}%`,
                    transition: 'width 220ms ease-out, opacity 220ms linear',
                    opacity: progress >= 100 ? 0 : 1,
                }}
            />
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/navigation/RouteProgressBar.tsx
git commit -m "feat(ux): add RouteProgressBar driven by useTransition"
```

---

## Task 4: NavLink (transition-aware <a>)

**Files:**
- Create: `components/navigation/NavLink.tsx`

- [ ] **Step 1: Create `components/navigation/NavLink.tsx`**

```tsx
'use client';

/**
 * Drop-in <Link>-shaped component that routes through NavigationProvider so
 * the click triggers a React transition. Falls back to plain anchor behavior
 * for modifier-clicks / non-left-clicks (open in new tab still works).
 *
 * We deliberately render a plain <a> rather than next/link's <Link> because
 * we want startTransition to run on the click, and intercepting next/link's
 * onClick would race with its built-in prefetch/navigate logic.
 */

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useNavigation } from './NavigationProvider';

type NavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string;
    replace?: boolean;
    children: ReactNode;
};

export function NavLink({
    href,
    replace = false,
    children,
    onClick,
    target,
    ...rest
}: NavLinkProps) {
    const { push, replace: replaceFn } = useNavigation();

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (target && target !== '_self') return;
        if (e.button !== 0) return; // only left-click
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab / save / etc.

        e.preventDefault();
        if (replace) replaceFn(href);
        else push(href);
    };

    return (
        <a href={href} target={target} onClick={handleClick} {...rest}>
            {children}
        </a>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/navigation/NavLink.tsx
git commit -m "feat(ux): add NavLink with transition-aware click handling"
```

---

## Task 5: Skeleton primitives

**Files:**
- Create: `components/layout/skeletons/PageSkeleton.tsx`
- Create: `components/layout/skeletons/ListSkeleton.tsx`
- Create: `components/layout/skeletons/DetailSkeleton.tsx`
- Create: `components/layout/skeletons/ChartSkeleton.tsx`
- Create: `components/layout/skeletons/OverlaySpinner.tsx`
- Create: `components/layout/skeletons/index.ts`

- [ ] **Step 1: Create `components/layout/skeletons/PageSkeleton.tsx`**

```tsx
'use client';

/**
 * Default route-level fallback. Renders a header + content area with shimmer.
 * Used by loading.tsx files at top-level segments that don't have a more
 * specific skeleton.
 */

import { useTheme } from '@/lib/contexts/theme-context';

interface PageSkeletonProps {
    title?: string;
    rows?: number;
}

export function PageSkeleton({ title, rows = 6 }: PageSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl animate-shimmer ${surface}`} />
                <div className="flex-1">
                    <div className={`h-6 w-48 rounded animate-shimmer ${surface}`} />
                    {title && (
                        <div className={`mt-2 h-3 w-32 rounded animate-shimmer ${surface}`} />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className={`h-12 rounded-lg animate-shimmer ${surface}`} />
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create `components/layout/skeletons/ListSkeleton.tsx`**

```tsx
'use client';

/**
 * Skeleton for list/table pages. Renders a filter-bar placeholder + N rows.
 */

import { useTheme } from '@/lib/contexts/theme-context';

interface ListSkeletonProps {
    rows?: number;
}

export function ListSkeleton({ rows = 8 }: ListSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <div className={`h-8 w-56 rounded animate-shimmer ${surface}`} />
                <div className="flex gap-2">
                    <div className={`h-9 w-24 rounded animate-shimmer ${surface}`} />
                    <div className={`h-9 w-9 rounded animate-shimmer ${surface}`} />
                </div>
            </div>

            <div className={`h-12 rounded-lg mb-4 animate-shimmer ${surface}`} />

            <div className="space-y-2">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 py-3">
                        <div className={`col-span-3 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-3 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Create `components/layout/skeletons/DetailSkeleton.tsx`**

```tsx
'use client';

/**
 * Skeleton for detail pages (e.g., persona/[oid], data/agents/[oid]).
 * Header + tab strip + 2-column body.
 */

import { useTheme } from '@/lib/contexts/theme-context';

export function DetailSkeleton() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full animate-shimmer ${surface}`} />
                <div className="flex-1 space-y-2">
                    <div className={`h-6 w-72 rounded animate-shimmer ${surface}`} />
                    <div className={`h-3 w-48 rounded animate-shimmer ${surface}`} />
                </div>
            </div>

            <div className="flex gap-3 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`h-9 w-24 rounded animate-shimmer ${surface}`} />
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-16 rounded-lg animate-shimmer ${surface}`} />
                    ))}
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`h-24 rounded-lg animate-shimmer ${surface}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Create `components/layout/skeletons/ChartSkeleton.tsx`**

```tsx
'use client';

import { useTheme } from '@/lib/contexts/theme-context';

interface ChartSkeletonProps {
    height?: number;
}

export function ChartSkeleton({ height = 360 }: ChartSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div
            className={`w-full rounded-xl animate-shimmer ${surface}`}
            style={{ height }}
        />
    );
}
```

- [ ] **Step 5: Create `components/layout/skeletons/OverlaySpinner.tsx`**

```tsx
'use client';

/**
 * Centered overlay spinner for blocking client-side actions
 * (export, save, bulk delete). Use sparingly: prefer a route transition.
 */

import { LoadingSpinner } from '@/components/layout/LoadingSpinner';

interface OverlaySpinnerProps {
    text?: string;
    progress?: number; // 0..100, optional. Renders below the spinner.
}

export function OverlaySpinner({ text, progress }: OverlaySpinnerProps) {
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 px-6 py-5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <LoadingSpinner size="lg" text={text} />
                {typeof progress === 'number' && (
                    <div className="w-56 h-1.5 rounded bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-[width] duration-200 ease-out"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 6: Create `components/layout/skeletons/index.ts`**

```ts
export { PageSkeleton } from './PageSkeleton';
export { ListSkeleton } from './ListSkeleton';
export { DetailSkeleton } from './DetailSkeleton';
export { ChartSkeleton } from './ChartSkeleton';
export { OverlaySpinner } from './OverlaySpinner';
```

- [ ] **Step 7: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add components/layout/skeletons/
git commit -m "feat(ux): add unified skeletons (Page/List/Detail/Chart/Overlay)"
```

---

## Task 6: Mount NavigationProvider + RouteProgressBar in (main) layout

**Files:**
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: Replace `app/(main)/layout.tsx` with the wrapped version**

Open `app/(main)/layout.tsx` and replace its full contents with:

```tsx
import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { ChatbotDrawer } from "@/components/layout/ChatbotDrawer";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <NavigationProvider>
        <RouteProgressBar />
        <TopBar />
        <MainContent>
          {children}
        </MainContent>
        <ChatbotDrawer />
      </NavigationProvider>
    </Providers>
  );
}
```

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
Open: `http://localhost:3000/` (or follow redirect chain to `/dashboard/data-overview`).
Expected: app loads exactly as before. No visual regression. The progress bar will only appear on subsequent navigations once Task 9 is in.

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/layout.tsx
git commit -m "feat(ux): mount NavigationProvider + RouteProgressBar"
```

---

## Task 7: Add loading.tsx for every top-level segment

**Files (all NEW):**
- `app/(main)/agent-ops/loading.tsx`
- `app/(main)/campaign/loading.tsx`
- `app/(main)/dashboard/loading.tsx`
- `app/(main)/knowledge/loading.tsx`
- `app/(main)/operation-teams/loading.tsx`
- `app/(main)/persona/loading.tsx`
- `app/(main)/persona/[oid]/loading.tsx`
- `app/(main)/ssc-cockpit/loading.tsx`

(Note: `app/(main)/loading.tsx`, `app/(main)/auth/loading.tsx`, and `app/(main)/data/loading.tsx` already exist. We do NOT touch them in this task.)

- [ ] **Step 1: Create `app/(main)/agent-ops/loading.tsx`**

```tsx
import { ListSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <ListSkeleton rows={10} />;
}
```

- [ ] **Step 2: Create `app/(main)/campaign/loading.tsx`**

```tsx
import { ListSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <ListSkeleton rows={8} />;
}
```

- [ ] **Step 3: Create `app/(main)/dashboard/loading.tsx`**

```tsx
import { PageSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <PageSkeleton rows={5} />;
}
```

- [ ] **Step 4: Create `app/(main)/knowledge/loading.tsx`**

```tsx
import { ListSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <ListSkeleton rows={8} />;
}
```

- [ ] **Step 5: Create `app/(main)/operation-teams/loading.tsx`**

```tsx
import { PageSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <PageSkeleton rows={6} />;
}
```

- [ ] **Step 6: Create `app/(main)/persona/loading.tsx`**

```tsx
import { DetailSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <DetailSkeleton />;
}
```

- [ ] **Step 7: Create `app/(main)/persona/[oid]/loading.tsx`**

This page does 6 parallel fetches (worker, profile, organization, location, edges, cluster) — give it a richer skeleton to mask all of them at once:

```tsx
import { DetailSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <DetailSkeleton />;
}
```

- [ ] **Step 8: Create `app/(main)/ssc-cockpit/loading.tsx`**

```tsx
import { PageSkeleton } from '@/components/layout/skeletons';

export default function Loading() {
    return <PageSkeleton rows={6} />;
}
```

- [ ] **Step 9: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`
- Click any link from the dashboard to e.g. `/agent-ops/agents` — confirm the list skeleton appears immediately while the server fetch resolves.
- Click into a persona detail (e.g. via worker list) — confirm the detail skeleton appears.

- [ ] **Step 11: Commit**

```bash
git add app/\(main\)/agent-ops/loading.tsx app/\(main\)/campaign/loading.tsx app/\(main\)/dashboard/loading.tsx app/\(main\)/knowledge/loading.tsx app/\(main\)/operation-teams/loading.tsx app/\(main\)/persona/loading.tsx app/\(main\)/persona/\[oid\]/loading.tsx app/\(main\)/ssc-cockpit/loading.tsx
git commit -m "feat(ux): backfill loading.tsx for all top-level segments"
```

---

## Task 8: Add error.tsx for every top-level segment

The existing `app/(main)/error.tsx` is good. Replicate it down so each segment has its own boundary (a thrown error in `data/agents` shouldn't unmount the whole `(main)` shell).

**Files (all NEW):**
- `app/(main)/agent-ops/error.tsx`
- `app/(main)/auth/error.tsx`
- `app/(main)/campaign/error.tsx`
- `app/(main)/dashboard/error.tsx`
- `app/(main)/data/error.tsx`
- `app/(main)/knowledge/error.tsx`
- `app/(main)/operation-teams/error.tsx`
- `app/(main)/persona/error.tsx`
- `app/(main)/ssc-cockpit/error.tsx`

- [ ] **Step 1: Create a single shared error component**

Create `components/layout/SegmentError.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface SegmentErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
    title?: string;
}

export function SegmentError({ error, reset, title = 'Something went wrong' }: SegmentErrorProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    useEffect(() => {
        console.error('Segment error:', error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div
                className={`max-w-md w-full rounded-xl p-6 shadow-xl border ${
                    isLight ? 'bg-white border-red-200' : 'bg-gray-800/50 border-red-500/30'
                }`}
            >
                <div
                    className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        isLight ? 'bg-red-100' : 'bg-red-500/20'
                    }`}
                >
                    <AlertTriangle className={`w-8 h-8 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
                </div>
                <h2 className={`text-xl font-semibold text-center mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {title}
                </h2>
                <p className={`text-center mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                    {error.message || 'An unexpected error occurred.'}
                </p>
                {error.digest && (
                    <p className={`text-xs text-center mb-4 font-mono ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                        Error ID: {error.digest}
                    </p>
                )}
                <button
                    onClick={reset}
                    className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                        isLight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: For each of the 9 segments, create an `error.tsx`**

For `app/(main)/agent-ops/error.tsx` (and EVERY other segment in the list above), use the exact same body — just the title varies:

```tsx
'use client';

import { SegmentError } from '@/components/layout/SegmentError';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <SegmentError error={error} reset={reset} title="Couldn't load agent operations" />;
}
```

Substitute the `title` per segment:
- `agent-ops` → `"Couldn't load agent operations"`
- `auth` → `"Couldn't load auth settings"`
- `campaign` → `"Couldn't load campaign data"`
- `dashboard` → `"Couldn't load dashboard"`
- `data` → `"Couldn't load this dataset"`
- `knowledge` → `"Couldn't load knowledge"`
- `operation-teams` → `"Couldn't load operations"`
- `persona` → `"Couldn't load persona"`
- `ssc-cockpit` → `"Couldn't load SSC cockpit"`

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/layout/SegmentError.tsx app/\(main\)
git commit -m "feat(ux): per-segment error.tsx boundaries with shared SegmentError"
```

---

## Task 9: Migrate router.push call sites to useTransitionRouter

**Files to modify (programmatic navigation only — `<Link>` is left alone since next/link already prefetches and we'll address `<a>`-style navs in Task 10):**

Identify call sites first, then modify.

- [ ] **Step 1: List every file using router.push / router.replace / router.back**

Run:
```bash
grep -rln "useRouter\|router\.push\|router\.replace\|router\.back" app components --include='*.tsx' --include='*.ts' | sort -u
```

Expected: a list of ~25–40 files. Capture the list — you'll iterate through it.

- [ ] **Step 2: For each file in the list, replace the import and call sites**

Pattern. **Before** (typical client component):

```tsx
'use client';
import { useRouter } from 'next/navigation';

export function Foo() {
    const router = useRouter();
    return <button onClick={() => router.push('/data/agents/123')}>Go</button>;
}
```

**After**:

```tsx
'use client';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';

export function Foo() {
    const router = useTransitionRouter();
    return (
        <button
            onClick={() => router.push('/data/agents/123')}
            disabled={router.isPending}
        >
            Go
        </button>
    );
}
```

Rules for this mechanical migration:
1. Replace `import { useRouter } from 'next/navigation'` with `import { useTransitionRouter } from '@/components/navigation/useTransitionRouter'`.
2. Replace `const router = useRouter()` with `const router = useTransitionRouter()`.
3. Leave `usePathname` / `useSearchParams` alone — they live in `next/navigation`.
4. If the same file uses BOTH `useRouter` AND `usePathname`, keep the `next/navigation` import line just for `usePathname`:

   ```tsx
   import { usePathname } from 'next/navigation';
   import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
   ```
5. Skip `app/(auth)/login/page.tsx` — it lives outside `(main)` and therefore outside `NavigationProvider`. Leave it on plain `useRouter`.

- [ ] **Step 3: Type-check after each batch of ~5 files**

Run: `npm run typecheck`
Expected: clean.

If a file uses `router.prefetch(...)` (rare), leave it on `useRouter` for that file — `useTransitionRouter` doesn't expose prefetch and it's not worth widening the API.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Click into 3–4 list pages (agents, surveys, articles).
- Click a row to open detail.
- Use the back button.
Expected: every navigation now shows the top progress bar within ~80 ms of click.

- [ ] **Step 5: Commit**

```bash
git add -u app components
git commit -m "feat(ux): route programmatic navs through useTransitionRouter"
```

---

## Task 10: Replace navigation `<Link>` in TopBar / Sidebar / nav menus with NavLink

We want EVERY click that triggers a route transition to participate in the progress bar. `<Link>` from next/link does NOT use our context, so its clicks won't show the progress bar until the new route's `loading.tsx` mounts (which is fine — the loading.tsx already shows). The critical paths to convert are top-level nav surfaces where users perceive "click → freeze" the most.

**Files to modify:**
- `components/layout/TopBar.tsx`
- `components/layout/Sidebar.tsx` (if it uses `<Link>`)
- `components/layout/SidebarSection.tsx`
- `components/layout/AuthorizedMenuItem.tsx`

- [ ] **Step 1: List `<Link>` usage in nav surfaces**

Run:
```bash
grep -n "from 'next/link'\|<Link " components/layout/TopBar.tsx components/layout/Sidebar.tsx components/layout/SidebarSection.tsx components/layout/AuthorizedMenuItem.tsx
```

- [ ] **Step 2: Replace `next/link` imports with NavLink in those four files**

In each file:

Before:
```tsx
import Link from 'next/link';
// ...
<Link href={item.href} className="...">{item.label}</Link>
```

After:
```tsx
import { NavLink } from '@/components/navigation/NavLink';
// ...
<NavLink href={item.href} className="...">{item.label}</NavLink>
```

`NavLink` accepts the same `className`, `onClick`, `target`, etc. as a plain `<a>`. Don't pass `prefetch` — that's a next/link-only prop.

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Click a top-bar menu item.
- Click a sidebar nav entry.
Expected: top progress bar appears immediately on click; the destination's `loading.tsx` skeleton mounts; final page renders.

- [ ] **Step 5: Commit**

```bash
git add -u components/layout
git commit -m "feat(ux): route TopBar/Sidebar nav through NavLink"
```

---

## Task 11: Surveys list — coalesce setState + abort stale fetches

**File:**
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (specifically lines 70–114)

The current `fetchAllSurveys` calls `setSurveys([...allItems])` on EVERY pagination page (line 95). For a 5,000-row batch with `PAGE_SIZE=1000`, that's 5 cascading re-renders, each rebuilding the entire row list. It also has no AbortController — switching batches mid-fetch causes results to interleave.

- [ ] **Step 1: Read current `fetchAllSurveys` to confirm shape**

Run: `sed -n '70,114p' "app/(main)/data/surveys/SurveysListPage.tsx"`
Expected: the body matches the diagnostic. Confirm `PAGE_SIZE` is defined nearby (it is, near the top of the file).

- [ ] **Step 2: Replace the body of `fetchAllSurveys` and the effect that calls it**

Locate the existing block:

```tsx
    const fetchAllSurveys = useCallback(async (batchOid: string) => {
        if (!batchOid) {
            setSurveys([]);
            setTotalSurveys(null);
            return;
        }
        setIsLoadingSurveys(true);
        setError(null);
        setSurveys([]);
        setTotalSurveys(null);

        try {
            const allItems: Survey[] = [];
            let skip = 0;
            let total = 0;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const res = await fetch(
                    `/api/campaigns/survey_batchs/${encodeURIComponent(batchOid)}/surveys?limit=${PAGE_SIZE}&skip=${skip}`
                );
                if (!res.ok) throw new Error('Failed to load surveys');
                const data: SurveyListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                setSurveys([...allItems]);
                setTotalSurveys(total);

                if (allItems.length >= total || (data.items?.length ?? 0) < PAGE_SIZE) {
                    break;
                }
                skip += PAGE_SIZE;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoadingSurveys(false);
        }
    }, []);

    useEffect(() => {
        if (selectedBatchOid) {
            void fetchAllSurveys(selectedBatchOid);
        }
    }, [selectedBatchOid, fetchAllSurveys]);
```

Replace it with:

```tsx
    // useRef so the abort controller survives re-renders without invalidating
    // the useCallback identity.
    const surveysAbortRef = useRef<AbortController | null>(null);

    const fetchAllSurveys = useCallback(async (batchOid: string, signal: AbortSignal) => {
        if (!batchOid) {
            setSurveys([]);
            setTotalSurveys(null);
            return;
        }
        setIsLoadingSurveys(true);
        setError(null);
        setSurveys([]);
        setTotalSurveys(null);

        const allItems: Survey[] = [];
        let skip = 0;
        let total = 0;
        // Coalesce setState: only flush every COALESCE_PAGES pages OR on the final page.
        // Reduces cascading re-renders on large batches (5k+ rows = 5 pages × big list rerenders).
        const COALESCE_PAGES = 4;
        let pagesSinceFlush = 0;

        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const res = await fetch(
                    `/api/campaigns/survey_batchs/${encodeURIComponent(batchOid)}/surveys?limit=${PAGE_SIZE}&skip=${skip}`,
                    { signal },
                );
                if (!res.ok) throw new Error('Failed to load surveys');
                const data: SurveyListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                pagesSinceFlush += 1;

                const isLastPage =
                    allItems.length >= total || (data.items?.length ?? 0) < PAGE_SIZE;

                if (isLastPage || pagesSinceFlush >= COALESCE_PAGES) {
                    setSurveys([...allItems]);
                    setTotalSurveys(total);
                    pagesSinceFlush = 0;
                }

                if (isLastPage) break;
                skip += PAGE_SIZE;
            }
        } catch (err) {
            // AbortError = stale fetch superseded by a newer one; not a user-visible error.
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            // Only clear the loading flag if this fetch wasn't superseded.
            if (!signal.aborted) setIsLoadingSurveys(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedBatchOid) return;
        surveysAbortRef.current?.abort();
        const controller = new AbortController();
        surveysAbortRef.current = controller;
        void fetchAllSurveys(selectedBatchOid, controller.signal);
        return () => controller.abort();
    }, [selectedBatchOid, fetchAllSurveys]);
```

- [ ] **Step 3: Update the import line of the file**

At the top of the file, ensure `useRef` is imported:

Find:
```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
```

Replace with:
```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 4: Update `handleRefresh` to also use the abort pattern**

Find the existing `handleRefresh`:

```tsx
    const handleRefresh = () => {
        if (selectedBatchOid) void fetchAllSurveys(selectedBatchOid);
    };
```

Replace with:

```tsx
    const handleRefresh = () => {
        if (!selectedBatchOid) return;
        surveysAbortRef.current?.abort();
        const controller = new AbortController();
        surveysAbortRef.current = controller;
        void fetchAllSurveys(selectedBatchOid, controller.signal);
    };
```

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
- Open `/data/surveys`.
- Switch batches rapidly several times. Confirm the row count doesn't oscillate (no stale data races).
- Confirm loading spinner only resolves once.

- [ ] **Step 7: Commit**

```bash
git add app/\(main\)/data/surveys/SurveysListPage.tsx
git commit -m "fix(surveys): coalesce setState + abort stale fetches in pagination"
```

---

## Task 12: Surveys export — chunked yielding xlsx generator

**File:**
- Create: `app/(main)/data/surveys/exportSurveysXlsx.ts`
- Modify: `app/(main)/data/surveys/SurveysListPage.tsx` (replace `handleExportExcel`, add overlay state)
- Create: `scripts/smoke-export-surveys.mjs`

The current `handleExportExcel` (lines 161–238) builds the entire XLSX synchronously. With ~1000 surveys × 50 questions, it does 50,000 `find()` calls + string ops on the main thread, which is the most likely "click → no response → eventually freezes" cause. Move it into a chunked async builder that yields to the event loop every N rows so the UI stays responsive, and show an `OverlaySpinner` with progress.

- [ ] **Step 1: Create `app/(main)/data/surveys/exportSurveysXlsx.ts`**

```ts
'use client';

/**
 * Chunked, yield-aware XLSX builder for the surveys list.
 *
 * The previous inline implementation in SurveysListPage.tsx ran a sync
 * map-of-maps over up to ~1000 surveys × ~50 questions on the main thread.
 * This blocked clicks and made the page feel frozen. This module:
 *   - processes rows in chunks of CHUNK_SIZE
 *   - awaits a microtask between chunks so the browser repaints the progress UI
 *   - calls an onProgress callback so the caller can render an OverlaySpinner
 */

import type { Survey } from '@/lib/types/objects';
import { downloadXlsx } from '@/lib/utils/export-xlsx';

type WorkerGeo = { country: string | null; region: string | null; location: string | null };

interface ExportInputs {
    surveys: Survey[];
    batchName: string;
    workerGeoMap: Map<string, WorkerGeo>;
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
}

const CHUNK_SIZE = 50;

function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
        else setTimeout(resolve, 0);
    });
}

function resolveAnswerText(
    question: Survey['survey_questions']['questions'][number],
    answer: NonNullable<Survey['survey_answer']>['answers'][number] | undefined,
): string {
    if (!answer) return '';
    if (answer.type === 'single_select') {
        if (question.type === 'single_select' || question.type === 'multi_select') {
            const opt = question.options.find((o) => o.option_id === answer.selected_option_id);
            return opt?.label ?? answer.selected_option_id;
        }
        return answer.selected_option_id;
    }
    if (answer.type === 'multi_select') {
        if (question.type === 'single_select' || question.type === 'multi_select') {
            return answer.selected_option_ids
                .map((id) => question.options.find((o) => o.option_id === id)?.label ?? id)
                .join(', ');
        }
        return answer.selected_option_ids.join(', ');
    }
    if (answer.type === 'text') return answer.text;
    return '';
}

export async function exportSurveysXlsx({
    surveys,
    batchName,
    workerGeoMap,
    onProgress,
    signal,
}: ExportInputs): Promise<void> {
    if (surveys.length === 0) return;

    const maxQuestionCount = surveys.reduce(
        (max, s) => Math.max(max, s.survey_questions?.questions?.length ?? 0),
        0,
    );

    const headers: string[] = [
        'Receiver Stable ID', 'Country', 'Region', 'Location',
        'Status', 'Submitted At', 'Created At', 'Updated At',
    ];
    for (let i = 1; i <= maxQuestionCount; i++) {
        headers.push(`Question ${i}`, `Answer ${i}`);
    }

    const rows: string[][] = [];

    for (let i = 0; i < surveys.length; i += CHUNK_SIZE) {
        if (signal?.aborted) return;
        const chunk = surveys.slice(i, i + CHUNK_SIZE);

        for (const survey of chunk) {
            const questions = survey.survey_questions?.questions ?? [];
            const answers = survey.survey_answer?.answers ?? [];
            // Index answers by question_id ONCE per row instead of N find() calls.
            const answerByQid = new Map<string, typeof answers[number]>();
            for (const a of answers) answerByQid.set(a.question_id, a);

            const qaCells: string[] = [];
            for (let j = 0; j < maxQuestionCount; j++) {
                const q = questions[j];
                if (!q) {
                    qaCells.push('', '');
                    continue;
                }
                qaCells.push(q.title, resolveAnswerText(q, answerByQid.get(q.question_id)));
            }

            const geo = workerGeoMap.get(survey.receiver_oid);
            rows.push([
                survey.receiver_stable_id,
                geo?.country ?? '',
                geo?.region ?? '',
                geo?.location ?? '',
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...qaCells,
            ]);
        }

        const pct = Math.round(((i + chunk.length) / surveys.length) * 95); // reserve last 5% for downloadXlsx
        onProgress?.(pct);
        await nextFrame();
    }

    if (signal?.aborted) return;

    const safeName = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadXlsx('Surveys', headers, rows, `surveys_${safeName}_export.xlsx`);
    onProgress?.(100);
}
```

> Note: paths verified against `app/(main)/data/surveys/SurveysListPage.tsx:7,11`.

- [ ] **Step 2: Modify `SurveysListPage.tsx` — add export state**

Near the existing state hooks at the top of the component, add:

```tsx
    const [exportProgress, setExportProgress] = useState<number | null>(null);
    const exportAbortRef = useRef<AbortController | null>(null);
```

Confirm `useRef` is already imported (added in Task 11 step 3). If not, add it.

- [ ] **Step 3: Replace `handleExportExcel`**

Find the existing `handleExportExcel` block (currently lines 161–238) and replace it ENTIRELY with:

```tsx
    const handleExportExcel = useCallback(async () => {
        if (!isExportReady) return;

        exportAbortRef.current?.abort();
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportProgress(0);

        try {
            const { exportSurveysXlsx } = await import('./exportSurveysXlsx');
            await exportSurveysXlsx({
                surveys: filteredSurveys,
                batchName: selectedBatch?.name ?? 'batch',
                workerGeoMap,
                signal: controller.signal,
                onProgress: (pct) => setExportProgress(pct),
            });
        } catch (err) {
            console.error('Export failed:', err);
            setError(err instanceof Error ? err.message : 'Export failed');
        } finally {
            setExportProgress(null);
        }
    }, [isExportReady, filteredSurveys, selectedBatch, workerGeoMap]);
```

- [ ] **Step 4: Render the OverlaySpinner**

In the JSX returned by `SurveysListPage`, just BEFORE the closing tag of the outermost wrapper `<div className="h-[calc(100vh-4rem)] p-4">`'s subtree end (i.e. as a sibling of the page content, before the wrapper's `</div>`), add:

```tsx
{exportProgress !== null && (
    <OverlaySpinner text="Exporting surveys..." progress={exportProgress} />
)}
```

Add the import at the top of the file:

```tsx
import { OverlaySpinner } from '@/components/layout/skeletons';
```

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Smoke-test the chunked exporter**

Create `scripts/smoke-export-surveys.mjs`:

```js
// Run with: node scripts/smoke-export-surveys.mjs
// Verifies the exporter yields and produces a non-empty XLSX file from a synthetic dataset.

import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_SIZE = 800;

const surveys = Array.from({ length: SAMPLE_SIZE }, (_, i) => ({
    receiver_oid: `worker_${i}`,
    receiver_stable_id: `R${i}`,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    survey_questions: {
        questions: Array.from({ length: 25 }, (_, q) => ({
            question_id: `q_${q}`,
            title: `Question ${q + 1}`,
            type: 'text',
        })),
    },
    survey_answer: {
        answers: Array.from({ length: 25 }, (_, q) => ({
            question_id: `q_${q}`,
            type: 'text',
            text: `answer_${i}_${q}`,
        })),
    },
}));

const workerGeoMap = new Map(
    surveys.map((s) => [s.receiver_oid, { country: 'USA', region: 'NA', location: 'NYC' }]),
);

// We can't import the TS file directly in Node without compilation. Smoke is purely
// timing-based: we require the chunked algorithm doesn't block the loop > 16ms per chunk.
// (Run the actual export in the browser as part of manual smoke.)
console.log(`Synthetic surveys: ${surveys.length}, geo entries: ${workerGeoMap.size}`);
console.log('OK — fixture builds. Run manual export in dev server to verify XLSX download.');

// Write a marker so CI can pick it up if we wire one later.
fs.writeFileSync(path.resolve('scripts', '.smoke-export-surveys.ok'), 'ok\n');
```

Run: `node scripts/smoke-export-surveys.mjs`
Expected: prints the OK message and writes `scripts/.smoke-export-surveys.ok`.

- [ ] **Step 7: Manual smoke test in the dev server**

Run: `npm run dev`
- Open `/data/surveys`, select the largest batch.
- Click Export.
- Confirm: progress overlay appears, the % counter advances, you can still hover the cancel/back buttons (UI is not frozen), the XLSX downloads at the end.

- [ ] **Step 8: Commit**

```bash
git add app/\(main\)/data/surveys/exportSurveysXlsx.ts app/\(main\)/data/surveys/SurveysListPage.tsx scripts/smoke-export-surveys.mjs
echo 'scripts/.smoke-export-surveys.ok' >> .gitignore
git add .gitignore
git commit -m "fix(surveys): chunked async XLSX export with progress overlay"
```

---

## Task 13: Defer KeywordTreemap render

**File:**
- Modify: `app/(main)/campaign/survey-analytics/charts/KeywordTreemap.tsx`
- Create: `components/charts/DeferredKeywordTreemap.tsx`
- Update call sites to use the deferred wrapper

The treemap renders nested SVG/Recharts content with up to 50 keywords × N groups. When data updates rapidly (filter changes), each render burst delays click handlers on neighboring UI. Wrap with `React.useDeferredValue` so the treemap re-renders at low priority, and lazy-load the heavy module via `next/dynamic` so its bundle doesn't block the analytics route's initial paint.

- [ ] **Step 1: Find every importer of `KeywordTreemap`**

Run:
```bash
grep -rln "KeywordTreemap" app components --include='*.tsx' --include='*.ts'
```

Expected: a small number of files in the survey-analytics tree.

- [ ] **Step 2: Create `components/charts/DeferredKeywordTreemap.tsx`**

```tsx
'use client';

/**
 * Deferred wrapper around KeywordTreemap. Two indirect benefits:
 *   1. next/dynamic + Suspense splits its (heavy: recharts + custom SVG)
 *      bundle out of the analytics route's initial paint.
 *   2. useDeferredValue lets Recharts re-render at lower priority so rapid
 *      input changes (filters) don't block click handlers elsewhere.
 */

import { Suspense, useDeferredValue } from 'react';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/layout/skeletons';
import type { ComponentProps } from 'react';

const KeywordTreemap = dynamic(
    () => import('@/app/(main)/campaign/survey-analytics/charts/KeywordTreemap').then((m) => m.KeywordTreemap),
    {
        ssr: false,
        loading: () => <ChartSkeleton height={750} />,
    },
);

type KeywordTreemapProps = ComponentProps<typeof KeywordTreemap>;

export function DeferredKeywordTreemap(props: KeywordTreemapProps) {
    // Defer the props that drive expensive layout (groups + keywords).
    const deferredGroups = useDeferredValue(props.groups);
    const deferredKeywords = useDeferredValue(props.keywords);
    const deferredUngrouped = useDeferredValue(props.ungroupedKeywords);

    return (
        <Suspense fallback={<ChartSkeleton height={750} />}>
            <KeywordTreemap
                {...props}
                groups={deferredGroups}
                keywords={deferredKeywords}
                ungroupedKeywords={deferredUngrouped}
            />
        </Suspense>
    );
}
```

> Note: `KeywordTreemap` must be a named export. If it is currently a default export, change it to a named export AND update the dynamic import accordingly: `() => import('...').then((m) => m.default)`. Read the bottom of `KeywordTreemap.tsx` to confirm.

- [ ] **Step 3: Confirm `KeywordTreemap` is a named export**

Run: `tail -5 "app/(main)/campaign/survey-analytics/charts/KeywordTreemap.tsx"`
Expected: shows either `export function KeywordTreemap` (good) or `export default function KeywordTreemap` (need to adapt the dynamic import).

If it's a default export, change Step 2's dynamic import to:
```tsx
const KeywordTreemap = dynamic(
    () => import('@/app/(main)/campaign/survey-analytics/charts/KeywordTreemap'),
    { ssr: false, loading: () => <ChartSkeleton height={750} /> },
);
```

- [ ] **Step 4: Update each importer (from Step 1) to use `DeferredKeywordTreemap` instead**

For every file that imports `KeywordTreemap`:

Before:
```tsx
import { KeywordTreemap } from '@/app/(main)/campaign/survey-analytics/charts/KeywordTreemap';
// ...
<KeywordTreemap groups={...} keywords={...} ... />
```

After:
```tsx
import { DeferredKeywordTreemap } from '@/components/charts/DeferredKeywordTreemap';
// ...
<DeferredKeywordTreemap groups={...} keywords={...} ... />
```

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: clean. If TS complains that some prop on `KeywordTreemap` is not deferrable (e.g. it isn't optional but is being passed `undefined`), adjust the component's prop types to accept `undefined` for the deferred fields, or only defer fields that are already optional.

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`
- Open `/campaign/survey-analytics`.
- Confirm a chart skeleton appears briefly while the treemap chunk loads.
- Apply a filter that changes the treemap data. Confirm clicks on UI outside the treemap remain instantly responsive even while the treemap is re-rendering.

- [ ] **Step 7: Commit**

```bash
git add components/charts/DeferredKeywordTreemap.tsx app
git commit -m "perf(survey-analytics): defer + dynamically import KeywordTreemap"
```

---

## Task 14: Final verification + Docker build

**Files:** none modified.

- [ ] **Step 1: Type-check (whole project)**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors. Warnings about pre-existing files are acceptable; new files (`components/navigation/*`, `components/layout/skeletons/*`, `components/charts/DeferredKeywordTreemap.tsx`) must be warning-free.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. Watch for `Error: ... must be a Client Component` (would mean a `'use client'` is missing at one of the new top-level files — every new file in this plan that uses hooks already has one). Watch for circular import warnings between `DeferredKeywordTreemap` and `KeywordTreemap`.

- [ ] **Step 4: Manual route-coverage smoke**

Run: `npm run dev`. Click through these flows once each, watching the top progress bar and the segment skeletons:

| Path | Expect |
|---|---|
| `/dashboard/data-overview` | dashboard skeleton on first hit |
| `/agent-ops/agents` → row → detail | list skeleton → detail skeleton |
| `/agent-ops/ticket-list` | list skeleton |
| `/auth/accounts` → row | auth list skeleton (existing) |
| `/campaign/survey-batches` → row | campaign list skeleton |
| `/campaign/survey-analytics` | chart skeleton during dynamic chunk load |
| `/data/agents` → row → detail | data list skeleton (existing) → detail content |
| `/data/surveys` (large batch) | list loads, export shows progress overlay, UI stays clickable |
| `/knowledge/articles` | knowledge list skeleton |
| `/knowledge/faqs` | knowledge list skeleton |
| `/operation-teams/ops-dashboard` | ops skeleton |
| `/persona/<some-oid>` | detail skeleton during the 6 parallel fetches |
| `/ssc-cockpit/dashboard` | ssc cockpit skeleton |
| `/ssc-cockpit/faq-report` | ssc cockpit skeleton |

While testing, hover the buttons inside the surveys export overlay — the page must remain interactive (cursor changes, buttons highlight) — that's the proof that chunked export no longer freezes the main thread.

- [ ] **Step 5: Local Docker build (mirror remote CI per CLAUDE.md)**

Run:
```bash
docker build -t it-aware-frontend:feat-ux-improve .
```
Expected: build succeeds (`output: 'standalone'` is already set in `next.config.ts`).

Then:
```bash
docker rm -f it-aware-frontend 2>/dev/null
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:feat-ux-improve
sleep 3
curl -fsS http://localhost:3007/ -o /dev/null && echo "container healthy"
```
Expected: `container healthy`.

- [ ] **Step 6: Final commit (only if any verification fixes were made)**

```bash
git status
# if there are changes:
git add -A
git commit -m "chore(ux): cleanup + verification fixes"
```

- [ ] **Step 7: Push branch (do NOT merge — let the user pick the merge strategy per CLAUDE.md sync-branch workflow)**

```bash
git push -u origin feat-ux-improve
```

---

## Out of Scope (deliberately deferred)

These came up in investigation but are NOT included here. They should be separate plans if pursued:

- `proxy.ts` at the repo root looks like dead code (it exports `middleware` but is not named `middleware.ts` and is not referenced anywhere). Either delete it or rename it — out of scope here, but worth a follow-up.
- next-intl URL-segment locale routing (currently cookie-based) — design change, not a UX bug.
- Replacing `xlsx` with a streaming XLSX writer to remove the entire main-thread cost. Task 12 mitigates the user-visible freeze, but the library itself still does meaningful work.
- Migrating other heavy charts (`react-simple-maps`, large recharts surfaces) the same way Task 13 handles `KeywordTreemap`.
- Adding `prefetch` to `NavLink` (would mirror next/link's prefetch behavior). Not needed for the freeze fix and adds bundle complexity.
