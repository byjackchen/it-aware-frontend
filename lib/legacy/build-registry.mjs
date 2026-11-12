#!/usr/bin/env node
// Regenerates lib/legacy/registry.json from the task catalog contract.
// Usage (Node 23.6 or later, which runs the TypeScript builder directly):
//   node lib/legacy/build-registry.mjs
// lib/legacy/build.test.ts fails while the committed file differs from this output.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRegistry, serializeRegistry } from './build.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const contract = JSON.parse(readFileSync(`${root}lib/tasks/contract-v3.json`, 'utf-8'));
const registry = buildRegistry(contract);
writeFileSync(`${root}lib/legacy/registry.json`, serializeRegistry(registry));
console.log(`lib/legacy/registry.json: ${registry.entries.length} entries`);
