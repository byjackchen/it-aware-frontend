import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { readBuildInfo } from './lib/build-info';

const withNextIntl = createNextIntlPlugin();

// GET /api/version: the commit and time of this build, inlined once here.
const build = readBuildInfo(process.cwd());

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    IT_AWARE_BUILD_COMMIT: build.commit,
    IT_AWARE_BUILD_TIME: build.built_at,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withNextIntl(nextConfig);
