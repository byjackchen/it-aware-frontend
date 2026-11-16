'use server';

/**
 * Server Actions for Manage Features: flip a flag, the one thing it controls. Each is recorded by the backend; each answers the event it
 * wrote, or the failure (its code and message) to show, such as a rule's refusal.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/features';
import { FEATURES_BASE } from '@/lib/features/view';
import { logger } from '@/lib/logger';
import type { JobsFailure } from '@/lib/types/jobs';
import type { FeatureEvent } from '@/lib/types/features';

export type FeaturesResult = { ok: true; data: FeatureEvent } | { ok: false; failure: JobsFailure };

async function change(action: string, work: () => Promise<FeatureEvent>): Promise<FeaturesResult> {
  const requestId = logger.generateRequestId();
  const result = await api.attempt(work);
  if (result.ok) {
    logger.info('Recorded', { requestId, action });
    revalidatePath(FEATURES_BASE);
  } else {
    logger.error('Failed', result.failure.message, { requestId, action, code: result.failure.code });
  }
  return result;
}

export async function flipFlag(code: string, flag: string, value: string, reason: string) {
  return change('Features:flag', () => api.flipFlag(code, flag, value, reason));
}
