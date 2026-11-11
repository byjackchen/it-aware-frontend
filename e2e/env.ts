/**
 * Who the specs act as and where the backend is. ci/e2e.sh sets these to the
 * hermetic stack's synthetic admin (gate.admin) and backend; the defaults are a
 * developer's local setup (backend on localhost:8007).
 */
export const USERNAME = process.env.E2E_USERNAME ?? 'byjackchen';
export const PASSWORD =
  process.env.E2E_PASSWORD ?? (USERNAME.length >= 8 ? USERNAME : USERNAME.padEnd(8, '0'));
export const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:8007').replace(/\/$/, '');
