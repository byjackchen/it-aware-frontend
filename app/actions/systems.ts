'use server';

/**
 * Server Actions for the Systems module (LLM Proxy config).
 * Thin wrappers over lib/api/systems with logging + path revalidation.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/systems';
import { logger } from '@/lib/logger';
import type {
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
  return run('Systems:createModel', () => api.createModel(data), '/systems/llm_proxy/models');
}
export async function updateModel(oid: string, data: LLMModelUpdate) {
  return run('Systems:updateModel', () => api.updateModel(oid, data), '/systems/llm_proxy/models');
}
export async function deleteModel(oid: string) {
  return run('Systems:deleteModel', () => api.deleteModel(oid), '/systems/llm_proxy/models');
}
export async function testModel(oid: string) {
  return run('Systems:testModel', () => api.testModel(oid));
}

// ── Routes ──────────────────────────────────────────────────────────────────
export async function createRoute(data: LLMRouteCreate) {
  return run('Systems:createRoute', () => api.createRoute(data), '/systems/llm_proxy/routes');
}
export async function updateRoute(oid: string, data: LLMRouteUpdate) {
  return run('Systems:updateRoute', () => api.updateRoute(oid, data), '/systems/llm_proxy/routes');
}
export async function deleteRoute(oid: string) {
  return run('Systems:deleteRoute', () => api.deleteRoute(oid), '/systems/llm_proxy/routes');
}
