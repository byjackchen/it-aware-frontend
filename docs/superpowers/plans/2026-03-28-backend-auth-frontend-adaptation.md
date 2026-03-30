# Backend Authorization Solidification — Frontend Adaptation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the frontend to gracefully handle backend authorization changes: worker sensitive field permissions, ABAC-filtered list/detail endpoints, and new 403 responses across analysis, scenario, worker cluster, and interaction resources.

**Architecture:** Three independent subsystems to modify: (1) Permission constants + worker sensitive field UI gating, (2) Core API client 403 handling with a reusable "access denied" page, (3) Detail page server components that distinguish 403 from 404. Each subsystem can be tested independently.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, `next-intl` for i18n, server actions, server components.

---

## Scope Assessment

This plan covers three independent but related concerns:

1. **Worker sensitive field permissions** — permission constants, conditional UI rendering, form error handling
2. **403 "Access Denied" handling** — core API client changes, dedicated access-denied page, detail page server components
3. **No-op awareness for ABAC-filtered lists** — documenting that list pages already handle reduced results correctly (no code changes needed)

All three produce working, testable software independently.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/config/permissions.ts` | Add `WORKERS_READ_SENSITIVE` and `WORKERS_EDIT_SENSITIVE` constants |
| Modify | `lib/api/core.ts` | Export error status code so callers can distinguish 403 vs other errors |
| Create | `lib/api/errors.ts` | `ApiError` class with `status` property |
| Create | `app/(main)/access-denied/page.tsx` | Dedicated "Access Denied" page for 403 redirects |
| Modify | `app/(main)/data/analyses/[oid]/page.tsx` | Catch 403 → redirect to access-denied instead of notFound |
| Modify | `app/(main)/data/scenarios/[oid]/page.tsx` | Catch 403 → redirect to access-denied instead of notFound |
| Modify | `app/(main)/data/interactions/[oid]/page.tsx` | Catch 403 → redirect to access-denied instead of notFound |
| Modify | `app/(main)/data/workers/[oid]/page.tsx` | Catch 403 → redirect to access-denied instead of notFound (for worker detail) |
| Modify | `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx` | Gate job field display/edit on `read_sensitive`/`edit_sensitive` permissions; handle 403 on save |
| Modify | `app/(main)/data/workers/new/WorkerCreatePage.tsx` | Gate job field inputs on `edit_sensitive` permission |
| Modify | `app/(main)/persona/PersonaProfilePage.tsx` | Gate job field display on `read_sensitive` permission |
| Modify | `messages/en.json` | Add `sensitiveFieldHidden`, `accessDenied` messages |

---

### Task 1: Add Permission Constants for Worker Sensitive Fields

**Files:**
- Modify: `lib/config/permissions.ts:27-28`

- [ ] **Step 1: Add the two new permission constants**

In `lib/config/permissions.ts`, add two new entries to the `OBJECTS` section, right after the existing `WORKERS_EDIT` line (line 28):

```typescript
WORKERS_READ_SENSITIVE: 'objects:workers:read_sensitive',
WORKERS_EDIT_SENSITIVE: 'objects:workers:edit_sensitive',
```

The full `OBJECTS` section should now include:
```typescript
WORKERS_READ: 'objects:workers:read',
WORKERS_EDIT: 'objects:workers:edit',
WORKERS_READ_SENSITIVE: 'objects:workers:read_sensitive',
WORKERS_EDIT_SENSITIVE: 'objects:workers:edit_sensitive',
WORKER_HIERARCHY_ROLES_READ: 'objects:worker_hierarchy_roles:read',
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `permissions.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/config/permissions.ts
git commit -m "feat: add worker read_sensitive and edit_sensitive permission constants"
```

---

### Task 2: Create ApiError Class for Status-Aware Error Handling

**Files:**
- Create: `lib/api/errors.ts`
- Modify: `lib/api/core.ts:32-39`

- [ ] **Step 1: Create the ApiError class**

Create `lib/api/errors.ts`:

```typescript
/**
 * Custom error class for API responses that includes the HTTP status code.
 * Allows callers to distinguish 403 (access denied) from 404 (not found) and other errors.
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
```

- [ ] **Step 2: Use ApiError in the core fetchApi function**

In `lib/api/core.ts`, replace the existing error-throwing block (lines 32-39):

Old:
```typescript
    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        const message = typeof error?.message === 'string'
            ? error.message
            : typeof error?.detail === 'string'
                ? error.detail
                : null;
        throw new Error(message || `API Error: ${res.status}`);
    }
```

New:
```typescript
    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        const message = typeof error?.message === 'string'
            ? error.message
            : typeof error?.detail === 'string'
                ? error.detail
                : null;
        throw new ApiError(message || `API Error: ${res.status}`, res.status);
    }
```

Also add the import at the top of `lib/api/core.ts`:
```typescript
import { ApiError } from '@/lib/api/errors';
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add lib/api/errors.ts lib/api/core.ts
git commit -m "feat: add ApiError class with HTTP status code for 403/404 distinction"
```

---

### Task 3: Add i18n Messages for Sensitive Fields and Access Denied

**Files:**
- Modify: `messages/en.json`

- [ ] **Step 1: Read current messages file to find insertion points**

Read `messages/en.json` and locate the `"Data"` section, specifically the `"workers"` subsection and the `"common"` subsection.

- [ ] **Step 2: Add new messages**

Add to the `"workers"` subsection inside `"Data"`:
```json
"sensitiveFieldHidden": "Restricted",
"sensitiveFieldNoEdit": "You do not have permission to edit sensitive job fields."
```

Add a new top-level `"AccessDenied"` section:
```json
"AccessDenied": {
    "title": "Access Denied",
    "message": "You don't have permission to access this resource. It may be outside your organizational scope.",
    "goBack": "Go Back",
    "goHome": "Go Home"
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json
git commit -m "feat: add i18n messages for sensitive field restrictions and access denied page"
```

---

### Task 4: Create Access Denied Page

**Files:**
- Create: `app/(main)/access-denied/page.tsx`

- [ ] **Step 1: Create the access-denied page**

Create `app/(main)/access-denied/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTranslations } from 'next-intl';

export default function AccessDeniedPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const t = useTranslations('AccessDenied');
    const isLight = theme === 'light';

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div
                className={`
                    max-w-md w-full rounded-xl p-6 shadow-xl border
                    ${isLight
                        ? 'bg-white border-amber-200'
                        : 'bg-gray-800/50 border-amber-500/30'
                    }
                `}
            >
                <div
                    className={`
                        mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4
                        ${isLight ? 'bg-amber-100' : 'bg-amber-500/20'}
                    `}
                >
                    <ShieldX
                        className={`w-8 h-8 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                    />
                </div>

                <h2
                    className={`text-xl font-semibold text-center mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}
                >
                    {t('title')}
                </h2>

                <p
                    className={`text-center mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}
                >
                    {t('message')}
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={() => router.back()}
                        className={`
                            flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-lg
                            font-medium transition-colors
                            ${isLight
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300'
                            }
                        `}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('goBack')}
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className={`
                            flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-lg
                            font-medium transition-colors
                            ${isLight
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }
                        `}
                    >
                        <Home className="w-4 h-4" />
                        {t('goHome')}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/access-denied/page.tsx
git commit -m "feat: add dedicated access-denied page for 403 responses"
```

---

### Task 5: Update Detail Page Server Components to Distinguish 403 from 404

**Files:**
- Modify: `app/(main)/data/analyses/[oid]/page.tsx:49-51`
- Modify: `app/(main)/data/scenarios/[oid]/page.tsx:31-33`
- Modify: `app/(main)/data/interactions/[oid]/page.tsx:20-22`
- Modify: `app/(main)/data/workers/[oid]/page.tsx:18-22`

All four detail page server components currently catch all errors with `catch { notFound() }`. They need to check if the error is a 403 `ApiError` and redirect to `/access-denied` instead.

- [ ] **Step 1: Update the analysis detail page**

In `app/(main)/data/analyses/[oid]/page.tsx`, replace:

```typescript
    } catch {
        notFound();
    }
```

With:

```typescript
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
```

Add these imports at the top:
```typescript
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
```

Note: `redirect` from `next/navigation` is already available since `notFound` comes from the same package. Just add it to the existing import.

- [ ] **Step 2: Update the scenario detail page**

In `app/(main)/data/scenarios/[oid]/page.tsx`, same pattern. Replace:

```typescript
    } catch {
        notFound();
    }
```

With:

```typescript
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
```

Add imports:
```typescript
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
```

- [ ] **Step 3: Update the interaction detail page**

In `app/(main)/data/interactions/[oid]/page.tsx`, same pattern. Replace:

```typescript
    } catch {
        notFound();
    }
```

With:

```typescript
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
```

Add imports:
```typescript
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
```

- [ ] **Step 4: Update the worker detail page**

In `app/(main)/data/workers/[oid]/page.tsx`, the first catch block (lines 20-22) currently wraps `getWorker()`. Replace:

```typescript
    } catch {
        notFound();
    }
```

With:

```typescript
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
```

Also update the second catch block (inside the async IIFE, line 35-37) the same way:

```typescript
        } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
                redirect('/access-denied');
            }
            notFound();
        }
```

Add imports:
```typescript
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
```

- [ ] **Step 5: Verify all files compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/\(main\)/data/analyses/\[oid\]/page.tsx app/\(main\)/data/scenarios/\[oid\]/page.tsx app/\(main\)/data/interactions/\[oid\]/page.tsx app/\(main\)/data/workers/\[oid\]/page.tsx
git commit -m "feat: distinguish 403 from 404 in detail page server components, redirect to access-denied"
```

---

### Task 6: Also Update Incident and Request Detail Pages

**Files:**
- Modify: `app/(main)/data/incidents/[oid]/page.tsx`
- Modify: `app/(main)/data/requests/[oid]/page.tsx`

These pages also have ABAC-filtered endpoints per the backend specs (activities domain).

- [ ] **Step 1: Read and update the incident detail page**

Read `app/(main)/data/incidents/[oid]/page.tsx`. It likely has the same `catch { notFound() }` pattern. Apply the same 403-aware pattern:

```typescript
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
```

And in the catch block:
```typescript
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
```

- [ ] **Step 2: Read and update the request detail page**

Read `app/(main)/data/requests/[oid]/page.tsx`. It uses `.catch(() => notFound())` on the Promise.all. Replace:

```typescript
    ]).catch(() => notFound());
```

With:
```typescript
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });
```

Add the same imports.

- [ ] **Step 3: Verify all files compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/incidents/\[oid\]/page.tsx app/\(main\)/data/requests/\[oid\]/page.tsx
git commit -m "feat: add 403 handling to incident and request detail pages"
```

---

### Task 7: Gate Worker Job Fields on read_sensitive Permission (Display)

**Files:**
- Modify: `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx:460-538`
- Modify: `app/(main)/persona/PersonaProfilePage.tsx:174-197`

When the user lacks `objects:workers:read_sensitive`, the backend returns `null` for all 6 job fields. Currently, `null` renders as "Not set" — but we need to distinguish "Not set" (field genuinely empty) from "Restricted" (field hidden by permission). The approach: check if the user has `read_sensitive` permission; if not, show the `sensitiveFieldHidden` message instead of the field value.

- [ ] **Step 1: Update WorkerDetailPage to import permissions hook and constants**

At the top of `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx`, add:

```typescript
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
```

Inside the component function (after the existing hooks around line 99), add:

```typescript
const { hasPermission } = usePermissions();
const canReadSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_READ_SENSITIVE);
const canEditSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_EDIT_SENSITIVE);
```

- [ ] **Step 2: Update the 6 job field display blocks in WorkerDetailPage**

For each of the 6 job fields (job_category, job_subcategory, job_professional_level, job_management_level, job_band, job_title), update the display (non-editing) rendering.

**Job Category** (around line 460-471). Replace:
```tsx
                        {/* Job Category */}
                        <div>
                            <label className={labelClass}>{t('workers.jobCategory')}</label>
                            {isEditing ? (
                                <input type="text" value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.job_category || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Category */}
                        <div>
                            <label className={labelClass}>{t('workers.jobCategory')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_category || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

**Job Subcategory** (around line 473-484). Replace:
```tsx
                        {/* Job Subcategory */}
                        <div>
                            <label className={labelClass}>{t('workers.jobSubcategory')}</label>
                            {isEditing ? (
                                <input type="text" value={jobSubcategory} onChange={(e) => setJobSubcategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.job_subcategory || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Subcategory */}
                        <div>
                            <label className={labelClass}>{t('workers.jobSubcategory')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobSubcategory} onChange={(e) => setJobSubcategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_subcategory || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

**Job Professional Level** (around line 488-498). Replace:
```tsx
                        {/* Job Professional Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobProfessionalLevel')}</label>
                            {isEditing ? (
                                <input type="text" value={jobProfessionalLevel} onChange={(e) => setJobProfessionalLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.job_professional_level || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Professional Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobProfessionalLevel')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobProfessionalLevel} onChange={(e) => setJobProfessionalLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_professional_level || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

**Job Management Level** (around line 501-512). Replace:
```tsx
                        {/* Job Management Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobManagementLevel')}</label>
                            {isEditing ? (
                                <input type="text" value={jobManagementLevel} onChange={(e) => setJobManagementLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Users className={iconClass} />
                                    <span className={textClass}>{worker.job_management_level || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Management Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobManagementLevel')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobManagementLevel} onChange={(e) => setJobManagementLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Users className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_management_level || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

**Job Band** (around line 514-525). Replace:
```tsx
                        {/* Job Band */}
                        <div>
                            <label className={labelClass}>{t('workers.jobBand')}</label>
                            {isEditing ? (
                                <input type="text" value={jobBand} onChange={(e) => setJobBand(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.job_band || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Band */}
                        <div>
                            <label className={labelClass}>{t('workers.jobBand')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobBand} onChange={(e) => setJobBand(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_band || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

**Job Title** (around line 527-538). Replace:
```tsx
                        {/* Job Title */}
                        <div>
                            <label className={labelClass}>{t('workers.jobTitle')}</label>
                            {isEditing ? (
                                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.job_title || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
```

With:
```tsx
                        {/* Job Title */}
                        <div>
                            <label className={labelClass}>{t('workers.jobTitle')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_title || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
```

- [ ] **Step 3: Update PersonaProfilePage to gate job fields**

In `app/(main)/persona/PersonaProfilePage.tsx`, add imports:

```typescript
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
```

Inside the component, add:
```typescript
const { hasPermission } = usePermissions();
const canReadSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_READ_SENSITIVE);
```

Update each of the 6 job field display lines (around lines 174-197). For each field, change:

```tsx
<div className={valueClass}>{currentWorker.job_category || t('status.notSet')}</div>
```

To:
```tsx
<div className={valueClass}>{canReadSensitive ? (currentWorker.job_category || t('status.notSet')) : tData('workers.sensitiveFieldHidden')}</div>
```

Apply the same pattern for: `job_subcategory`, `job_professional_level`, `job_management_level`, `job_band`, `job_title`.

Also update the header subtitle (around line 79) from:
```tsx
{currentWorker.job_title || currentWorker.job_band || t('status.notSet')}
```
To:
```tsx
{canReadSensitive ? (currentWorker.job_title || currentWorker.job_band || t('status.notSet')) : tData('workers.sensitiveFieldHidden')}
```

- [ ] **Step 4: Verify all files compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/\(main\)/data/workers/\[oid\]/WorkerDetailPage.tsx app/\(main\)/persona/PersonaProfilePage.tsx
git commit -m "feat: gate worker job field display on read_sensitive permission, hide edit for edit_sensitive"
```

---

### Task 8: Gate Worker Create Form Job Fields on edit_sensitive Permission

**Files:**
- Modify: `app/(main)/data/workers/new/WorkerCreatePage.tsx:268-349`

- [ ] **Step 1: Add permission imports and check**

In `app/(main)/data/workers/new/WorkerCreatePage.tsx`, add imports:

```typescript
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
```

Inside the component function, add:
```typescript
const { hasPermission } = usePermissions();
const canEditSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_EDIT_SENSITIVE);
```

- [ ] **Step 2: Conditionally disable the 6 job field inputs**

For each of the 6 job field inputs in the create form (around lines 294-349), add `disabled={!canEditSensitive}` to each `<input>` element and add a visual cue.

**Job Category** input (around line 295-301). Replace:
```tsx
                            <div>
                                <label className={labelClass}>{t('workers.jobCategory')}</label>
                                <input
                                    type="text"
                                    value={jobCategory}
                                    onChange={(e) => setJobCategory(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
```

With:
```tsx
                            <div>
                                <label className={labelClass}>{t('workers.jobCategory')}</label>
                                <input
                                    type="text"
                                    value={jobCategory}
                                    onChange={(e) => setJobCategory(e.target.value)}
                                    className={inputClass}
                                    disabled={!canEditSensitive}
                                    placeholder={!canEditSensitive ? t('workers.sensitiveFieldHidden') : ''}
                                />
                            </div>
```

Apply the same pattern to the remaining 5 job fields: `jobSubcategory`, `jobProfessionalLevel`, `jobManagementLevel`, `jobBand`, `jobTitle`. Each input gets:
- `disabled={!canEditSensitive}`
- `placeholder={!canEditSensitive ? t('workers.sensitiveFieldHidden') : ''}`

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/workers/new/WorkerCreatePage.tsx
git commit -m "feat: disable job field inputs on worker create form when user lacks edit_sensitive"
```

---

### Task 9: Handle 403 on Worker Save (edit_sensitive error from backend)

**Files:**
- Modify: `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx:144-169`

If a user manages to submit job fields without `edit_sensitive` (e.g., the permission was revoked after page load), the backend returns 403 with `"Missing permission to edit sensitive fields: [...]"`. The save handler should catch this and show an error.

- [ ] **Step 1: Add error state and update handleSave**

In `WorkerDetailPage.tsx`, add an error state variable near the existing state declarations (around line 102):

```typescript
const [saveError, setSaveError] = useState<string | null>(null);
```

Update the `handleSave` function (lines 144-169). Replace:

```typescript
    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('fullname', fullname);
            formData.set('email', email);
            formData.set('worker_id', workerId);
            formData.set('location_oid', locationOid);
            formData.set('gender', gender);
            formData.set('worker_type', workerType);
            formData.set('job_category', jobCategory);
            formData.set('job_subcategory', jobSubcategory);
            formData.set('job_professional_level', jobProfessionalLevel);
            formData.set('job_management_level', jobManagementLevel);
            formData.set('job_band', jobBand);
            formData.set('job_title', jobTitle);
            formData.set('is_vip', String(isVip));
            formData.set('vip_type', isVip ? vipType : '');
            formData.set('is_active', String(isActive));
            await updateWorkerAction(worker.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };
```

With:

```typescript
    const handleSave = async () => {
        setIsPending(true);
        setSaveError(null);
        try {
            const formData = new FormData();
            formData.set('fullname', fullname);
            formData.set('email', email);
            formData.set('worker_id', workerId);
            formData.set('location_oid', locationOid);
            formData.set('gender', gender);
            formData.set('worker_type', workerType);
            formData.set('job_category', jobCategory);
            formData.set('job_subcategory', jobSubcategory);
            formData.set('job_professional_level', jobProfessionalLevel);
            formData.set('job_management_level', jobManagementLevel);
            formData.set('job_band', jobBand);
            formData.set('job_title', jobTitle);
            formData.set('is_vip', String(isVip));
            formData.set('vip_type', isVip ? vipType : '');
            formData.set('is_active', String(isActive));
            await updateWorkerAction(worker.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save changes';
            setSaveError(message);
        } finally {
            setIsPending(false);
        }
    };
```

- [ ] **Step 2: Display the save error in the UI**

Find the edit mode action buttons area in the component (where Save/Cancel/Delete buttons are rendered). Add an error alert above or below the buttons:

```tsx
{saveError && (
    <div className={`p-3 rounded-lg text-sm ${isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
        {saveError}
    </div>
)}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/workers/\[oid\]/WorkerDetailPage.tsx
git commit -m "feat: show error message when worker save fails due to sensitive field permission"
```

---

### Task 10: Handle 403 on Analysis/Scenario Delete and Update (Client-Side Actions)

**Files:**
- Modify: `app/(main)/data/analyses/[oid]/AnalysisDetailPage.tsx`
- Modify: `app/(main)/data/scenarios/[oid]/ScenarioDetailPage.tsx`
- Modify: `app/(main)/data/interactions/[oid]/InteractionDetailPage.tsx`

The client-side detail pages call server actions for update/delete. If the backend returns 403, the server action will throw an error. The client components should catch this and show a meaningful message instead of a generic error.

- [ ] **Step 1: Read AnalysisDetailPage.tsx and identify save/delete handlers**

Read the file to locate the `handleSave` and `handleDelete` functions. They likely use `try/catch` or `startTransition`. The error message from the backend will propagate through the server action.

Currently these handlers likely show `alert()` on failure. Update them to show the actual error message, which will include "Access denied to this analysis" for 403 cases.

The existing error handling in these components already shows the error message from the thrown error. Verify this by reading the file. If the error message is already displayed (e.g., via `alert(error.message)` or state), no code change is needed — the backend's "Access denied to this analysis" message will surface automatically.

- [ ] **Step 2: Verify the error message propagation path**

The path is:
1. Backend returns `403 {"detail": "Access denied to this analysis"}`
2. `fetchApi()` in `core.ts` throws `ApiError("Access denied to this analysis", 403)`
3. Server action (e.g., `deleteAnalysisAction`) re-throws or returns the error
4. Client component catches and displays

Read `app/actions/objects.ts` to verify how the server actions handle errors. If they catch and return `{ error: message }` style responses, the client will already display the message. If they let the error propagate, the client-side `catch` block will see it.

- [ ] **Step 3: If changes are needed, update error handling in the three client components**

If the current error handling doesn't surface the error message to the user, add it. The pattern should be:

```typescript
} catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    alert(message);
}
```

This ensures "Access denied to this analysis" from a 403 is shown instead of a generic error.

- [ ] **Step 4: Commit (if changes were made)**

```bash
git add app/\(main\)/data/analyses/\[oid\]/AnalysisDetailPage.tsx app/\(main\)/data/scenarios/\[oid\]/ScenarioDetailPage.tsx app/\(main\)/data/interactions/\[oid\]/InteractionDetailPage.tsx
git commit -m "feat: surface access denied messages in analysis/scenario/interaction detail actions"
```

---

### Task 11: Final Verification — Build Check

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run the Next.js build**

Run: `npx next build 2>&1 | tail -40`
Expected: Build succeeds

- [ ] **Step 3: Run Docker build (per CLAUDE.md workflow)**

Run: `docker build -t it-aware-frontend:latest .`
Expected: Build succeeds

- [ ] **Step 4: Commit any remaining fixes**

If the build revealed issues, fix them and commit.

---

## What Does NOT Need Code Changes

### ABAC-Filtered List Endpoints (Analysis, Scenario, Worker Cluster, Interaction)

The list pages (`AnalysesListPage`, `ScenariosListPage`, `ClustersListPage`, `InteractionsListPage`) all use either manual pagination or `useInfiniteResource` to load items. Both patterns:

- Fetch from the backend via the proxy route `GET /api/objects/{resource}?...`
- Display whatever items the backend returns
- Show "No X found" as the empty state when zero items return
- Show a total count from the response headers

When the backend filters results by ABAC scope, the list pages automatically show fewer results — the total count header reflects the filtered count, and the empty state handles zero results. **No code changes are needed for list views.**

### InteractionResponse Schema

The `Interaction` TypeScript type in `lib/types/objects.ts` does not need changes. The backend added `actor_oid` as an internal column for ABAC resolution, but it is not exposed in the response schema.
