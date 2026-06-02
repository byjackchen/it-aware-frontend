'use server';

/**
 * Server Actions for the Systems module (LLM Proxy config).
 * Thin wrappers over lib/api/systems with logging + path revalidation.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/systems';
import { logger } from '@/lib/logger';
import type {
  LLMKeyCreate,
  LLMKeyUpdate,
  LLMModelCreate,
  LLMModelUpdate,
  LLMRouteCreate,
  LLMRouteUpdate,
} from '@/lib/types/systems';

type Result<T> = { success: true; data: T } | { error: string };

async function run<T>(action: string, fn: () => Promise<T>, ...revalidate: string[]): Promise<Result<T>> {
  const requestId = logger.generateRequestId();
  const startTime = Date.now();
  logger.info('Started', { requestId, action });
  try {
    const data = await fn();
    logger.info(`Success in ${Date.now() - startTime}ms`, { requestId, action });
    for (const path of revalidate) revalidatePath(path);
    return { success: true, data };
  } catch (error) {
    logger.error(`Failed after ${Date.now() - startTime}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : `Failed: ${action}` };
  }
}

// ── Models ──────────────────────────────────────────────────────────────────
export async function createModel(data: LLMModelCreate) {
  return run('Systems:createModel', () => api.createModel(data), '/systems/models');
}
export async function updateModel(oid: string, data: LLMModelUpdate) {
  return run('Systems:updateModel', () => api.updateModel(oid, data), '/systems/models');
}
export async function deleteModel(oid: string) {
  return run('Systems:deleteModel', () => api.deleteModel(oid), '/systems/models');
}

// ── Keys ────────────────────────────────────────────────────────────────────
export async function createKey(data: LLMKeyCreate) {
  return run('Systems:createKey', () => api.createKey(data), '/systems/keys', '/systems/models');
}
export async function updateKey(oid: string, data: LLMKeyUpdate) {
  return run('Systems:updateKey', () => api.updateKey(oid, data), '/systems/keys', '/systems/models');
}
export async function deleteKey(oid: string) {
  return run('Systems:deleteKey', () => api.deleteKey(oid), '/systems/keys', '/systems/models');
}

// ── Routes ──────────────────────────────────────────────────────────────────
export async function createRoute(data: LLMRouteCreate) {
  return run('Systems:createRoute', () => api.createRoute(data), '/systems/routes');
}
export async function updateRoute(oid: string, data: LLMRouteUpdate) {
  return run('Systems:updateRoute', () => api.updateRoute(oid, data), '/systems/routes');
}
export async function deleteRoute(oid: string) {
  return run('Systems:deleteRoute', () => api.deleteRoute(oid), '/systems/routes');
}
