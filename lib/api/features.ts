/**
 * Server-side client for Manage Features (backend `/features`,
 * it-aware-backend specs/api_specs_features.md).
 *
 * Errors come in Manage Jobs' shape (`{"detail": {"code", "message"}}`), so the
 * same error class and the same `attempt` / `read` helpers serve: a change the
 * rules refuse answers 409 with `code: "refused"` and the rule in `message`.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { JobsApiError, readFailure } from '@/lib/api/jobs';
import type {
  FeatureDetail,
  FeatureEvent,
  FeaturesResponse,
  MigrationRunDetail,
  MigrationRunsResponse,
} from '@/lib/types/features';

export { attempt, read } from '@/lib/api/jobs';

const BASE = `${RUNTIME_CONFIG.backend.domain}/features`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith('it_aware_'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    const { code, message } = readFailure(await res.json().catch(() => null), res.status);
    throw new JobsApiError(message, res.status, code);
  }
  return res.json();
}

const enc = encodeURIComponent;

// ── View ─────────────────────────────────────────────────────────────────────

export async function listFeatures(): Promise<FeaturesResponse> {
  return call('');
}

export async function getFeature(code: string): Promise<FeatureDetail> {
  return call(`/${enc(code)}`);
}

export async function listMigrationRuns(limit: number, offset: number): Promise<MigrationRunsResponse> {
  return call(`/migrations?limit=${limit}&offset=${offset}`);
}

export async function getMigrationRun(oid: string): Promise<MigrationRunDetail> {
  return call(`/migrations/${enc(oid)}`);
}

// ── Changes (each recorded by the backend) ───────────────────────────────────

function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  return call(path, { method, body: JSON.stringify(body) });
}

/** Set a flag to one of its values, with a reason. */
export async function flipFlag(code: string, flag: string, value: string, reason: string): Promise<FeatureEvent> {
  return post(`/${enc(code)}/flags/${enc(flag)}`, { value, reason }, 'PUT');
}
