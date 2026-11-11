import { NextResponse } from 'next/server';
import { buildInfoFromEnv } from '@/lib/build-info';

/**
 * GET /api/version: the deployed build's commit and build time, nothing else.
 * Public (the proxy's matcher skips /api/). The values are inlined at `next build`
 * by next.config.ts (lib/build-info.ts).
 */
export function GET() {
  return NextResponse.json(
    buildInfoFromEnv({
      IT_AWARE_BUILD_COMMIT: process.env.IT_AWARE_BUILD_COMMIT,
      IT_AWARE_BUILD_TIME: process.env.IT_AWARE_BUILD_TIME,
    }),
  );
}
