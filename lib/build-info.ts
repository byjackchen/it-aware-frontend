import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The build's commit and time, for GET /api/version.
 *
 * next.config.ts calls readBuildInfo() once, at `next build`, and inlines the two
 * values as env (IT_AWARE_BUILD_COMMIT, IT_AWARE_BUILD_TIME); the route only reads
 * them. The commit comes from the build context's .git/HEAD (only HEAD and the refs
 * pass .dockerignore). Without them (a `git archive`, a local dev run) it is
 * "unknown". Nothing else is exposed: no environment name, no dependency list.
 */

export type BuildInfo = { commit: string; built_at: string };

const SHA = /^[0-9a-f]{40}$/;

function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** The commit HEAD names: a detached SHA, or a branch ref (loose file or packed-refs). */
export function resolveCommit(gitDir: string): string | null {
  const head = read(join(gitDir, 'HEAD'))?.trim();
  if (!head) return null;
  if (SHA.test(head)) return head;
  if (!head.startsWith('ref: ')) return null;
  const ref = head.slice(5);
  let sha = read(join(gitDir, ref))?.trim() ?? '';
  if (!sha) {
    for (const line of (read(join(gitDir, 'packed-refs')) ?? '').split('\n')) {
      const [value, name] = line.trim().split(/\s+/);
      if (name === ref) {
        sha = value;
        break;
      }
    }
  }
  return SHA.test(sha) ? sha : null;
}

export function readBuildInfo(root: string, now: Date = new Date()): BuildInfo {
  return {
    commit: resolveCommit(join(root, '.git')) ?? 'unknown',
    built_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

/** What the route returns: the inlined build values, or "unknown". */
export function buildInfoFromEnv(env: Record<string, string | undefined>): BuildInfo {
  return {
    commit: env.IT_AWARE_BUILD_COMMIT || 'unknown',
    built_at: env.IT_AWARE_BUILD_TIME || 'unknown',
  };
}
