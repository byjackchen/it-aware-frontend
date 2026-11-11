import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/version/route';
import { buildInfoFromEnv, readBuildInfo, resolveCommit } from '@/lib/build-info';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER = 'fedcba9876543210fedcba9876543210fedcba98';

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'build-info-'));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, '.git', name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

describe('resolveCommit', () => {
  it('reads a detached HEAD', () => {
    expect(resolveCommit(join(repo({ HEAD: `${SHA}\n` }), '.git'))).toBe(SHA);
  });

  it('follows a branch HEAD to its loose ref', () => {
    const root = repo({ HEAD: 'ref: refs/heads/development\n', 'refs/heads/development': `${SHA}\n` });
    expect(resolveCommit(join(root, '.git'))).toBe(SHA);
  });

  it('falls back to packed-refs', () => {
    const root = repo({
      HEAD: 'ref: refs/heads/development\n',
      'packed-refs': `# pack-refs with: peeled\n${OTHER} refs/heads/master\n^${OTHER}\n${SHA} refs/heads/development\n`,
    });
    expect(resolveCommit(join(root, '.git'))).toBe(SHA);
  });

  it.each([
    ['no .git at all', {}],
    ['an empty HEAD', { HEAD: '\n' }],
    ['a HEAD that is neither', { HEAD: 'garbage\n' }],
    ['a ref found nowhere', { HEAD: 'ref: refs/heads/gone\n' }],
    ['a ref missing from packed-refs', { HEAD: 'ref: refs/heads/gone\n', 'packed-refs': `${OTHER} refs/heads/master\n` }],
    ['a ref that is not a SHA', { HEAD: 'ref: refs/heads/x\n', 'refs/heads/x': 'nope\n' }],
  ])('is null for %s', (_label, files) => {
    expect(resolveCommit(join(repo(files as Record<string, string>), '.git'))).toBeNull();
  });
});

describe('readBuildInfo', () => {
  it('records the commit and the build time in UTC to the second', () => {
    const info = readBuildInfo(repo({ HEAD: `${SHA}\n` }), new Date('2026-11-12T03:04:05.678Z'));
    expect(info).toEqual({ commit: SHA, built_at: '2026-11-12T03:04:05Z' });
  });

  it('says unknown without a commit, and defaults the time to now', () => {
    const info = readBuildInfo(repo({}));
    expect(info.commit).toBe('unknown');
    expect(info.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe('GET /api/version', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns only the inlined commit and time', async () => {
    vi.stubEnv('IT_AWARE_BUILD_COMMIT', SHA);
    vi.stubEnv('IT_AWARE_BUILD_TIME', '2026-11-12T03:04:05Z');
    const body = await GET().json();
    expect(body).toEqual({ commit: SHA, built_at: '2026-11-12T03:04:05Z' });
  });

  it('says unknown when the build inlined nothing', () => {
    expect(buildInfoFromEnv({})).toEqual({ commit: 'unknown', built_at: 'unknown' });
  });
});
