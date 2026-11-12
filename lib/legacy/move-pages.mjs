#!/usr/bin/env node
// Moves the pages under app/(main) to their task addresses and rewrites the
// links and imports that point at them, from the contract's `legacy` list
// (lib/tasks/contract-v3.json). Run once by lane F4; kept as the record of how
// the move was made. Usage (Node 23.6 or later, from the repo root):
//   node lib/legacy/move-pages.mjs [--dry-run]
//
// 1. Pages. A `view`, `record` or `pattern` entry's folder moves to its new
//    address under app/(main)/tasks/, with its co-located files. An `area` or
//    `special` entry's page.tsx is deleted (the legacy redirects take over);
//    co-located components of such a folder go where COMPONENT_HOMES says.
// 2. Boundaries (layout, error, loading, template, not-found) of a folder keep
//    applying to the same pages: each goes to the highest folder under
//    tasks/<task> that holds only pages from that folder, so it is moved when
//    one folder suffices and copied when its pages went to several tasks.
// 3. Imports of moved files (`@/app/(main)/...` and relative) are rewritten.
// 4. Links: a string or template literal whose path is an old page address of
//    a `view`, `record` or `pattern` entry becomes its new address (a `${...}`
//    segment stands for a placeholder; a query or fragment is kept). Literals
//    that hit an `area` or `special` entry, old-address prefixes and regular
//    expressions are only listed, for a hand fix.
// Backend API code (app/api/**, lib/api/**), lib/legacy/**, ci/ and the page
// matcher's generic fixtures (lib/tasks/pages.test.ts) are left alone.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { fillPattern, findEntry } from './build.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
process.chdir(root);
const DRY = process.argv.includes('--dry-run');
const MAIN = 'app/(main)';
const BOUNDARIES = new Set(['layout.tsx', 'error.tsx', 'loading.tsx', 'template.tsx', 'not-found.tsx']);

/** Where the co-located files of a folder whose page is removed go (old folder → new folder). */
const COMPONENT_HOMES = {
    'campaign/survey-analytics': 'tasks/it-operations-dashboard/csat', // the CSAT view's dashboard
    dashboard: 'tasks/data-overview', // ObjectStatsDashboard, the Data Overview page's
    'ohla-journey': 'tasks/ohla-journey-dashboard', // the journey reports, shared by every [section]
};

const contract = JSON.parse(readFileSync('lib/tasks/contract-v3.json', 'utf-8'));
const entries = contract.legacy.filter(e => e.type !== 'kept');
const MOVES = new Set(['view', 'record', 'pattern']);

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8' });
const tracked = git('ls-files').split('\n').filter(Boolean);
const mainFiles = tracked.filter(f => f.startsWith(`${MAIN}/`)).map(f => f.slice(MAIN.length + 1));

/** Old folder (relative to app/(main), '' for the root) of each page.tsx. */
const pageDirs = new Set(mainFiles.filter(f => posix.basename(f) === 'page.tsx').map(f => posix.dirname(f)));
const address = dir => (dir === '.' ? '/' : `/${dir}`);
const entryOf = dir => entries.find(e => e.old === address(dir));

/** Old page folder → new page folder (under app/(main)), for pages that move. */
const pageMoves = new Map();
const removedPages = [];
for (const dir of pageDirs) {
    const entry = entryOf(dir);
    if (!entry) continue; // kept: /, /home, /access-denied
    if (MOVES.has(entry.type)) pageMoves.set(dir, entry.new.slice(1));
    else removedPages.push(dir);
}

const parentOf = dir => (dir.includes('/') ? posix.dirname(dir) : '.');
const under = (path, base) => base === '.' || path === base || path.startsWith(`${base}/`);

/** The nearest folder at or above `dir` that holds a page, or null. */
function nearestPage(dir) {
    for (let d = dir; ; d = parentOf(d)) {
        if (pageDirs.has(d)) return d;
        if (d === '.') return null;
    }
}

/** New folders for a boundary file in old folder `dir`. */
function boundaryHomes(dir) {
    const governed = [...pageMoves].filter(([old]) => under(old, dir));
    const fromHere = new Set(governed.map(([, to]) => to));
    const allNew = [...pageMoves.values()];
    const homes = new Set();
    for (const to of fromHere) {
        let home = to;
        // Climb while the parent is inside a task folder and holds only pages from `dir`.
        while (home.split('/').length > 2) {
            const up = posix.dirname(home);
            if (!allNew.filter(p => under(p, up)).every(p => fromHere.has(p))) break;
            home = up;
        }
        homes.add(home);
    }
    return [...homes].filter(h => ![...homes].some(o => o !== h && under(h, o))).sort();
}

const fileMoves = new Map(); // old path → new path (both repo-relative); a copy is not listed
const copies = []; // [from (new path of the moved original), to]
const removed = [];
const manifest = { moved: [], removed: [], boundaries: [] };

for (const file of mainFiles) {
    const dir = posix.dirname(file);
    const name = posix.basename(file);
    // The root's files and the kept pages' folders stay.
    if (dir === '.' || ['home', 'access-denied'].includes(dir.split('/')[0])) continue;
    if (name === 'page.tsx' && removedPages.includes(dir)) {
        removed.push(`${MAIN}/${file}`);
        continue;
    }
    if (BOUNDARIES.has(name)) {
        const homes = boundaryHomes(dir);
        manifest.boundaries.push({ file: `${MAIN}/${file}`, to: homes.map(h => `${MAIN}/${h}/${name}`) });
        if (homes.length === 0) {
            removed.push(`${MAIN}/${file}`);
            continue;
        }
        fileMoves.set(`${MAIN}/${file}`, `${MAIN}/${homes[0]}/${name}`);
        for (const h of homes.slice(1)) copies.push([`${MAIN}/${homes[0]}/${name}`, `${MAIN}/${h}/${name}`]);
        continue;
    }
    const page = nearestPage(dir);
    let target;
    if (page !== null && pageMoves.has(page)) {
        target = pageMoves.get(page) + dir.slice(page.length);
    } else {
        const home = Object.keys(COMPONENT_HOMES)
            .sort((a, b) => b.length - a.length)
            .find(k => under(dir, k));
        if (!home) throw new Error(`no home for ${file}`);
        target = COMPONENT_HOMES[home] + dir.slice(home.length);
    }
    fileMoves.set(`${MAIN}/${file}`, `${MAIN}/${target}/${name}`);
}
manifest.moved = [...fileMoves].map(([from, to]) => `${from} -> ${to}`);
manifest.removed = removed;

// ---------------------------------------------------------------- imports

const SOURCE = /\.(ts|tsx|mjs|js|mts)$/;
const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '.module.css', '.css'];
const trackedSet = new Set(tracked);

function resolveFile(spec, fromFile) {
    let base;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
    else return null;
    for (const ext of EXT) if (trackedSet.has(base + ext)) return { file: base + ext, ext };
    return null;
}

function rewriteImport(spec, fromOld, fromNew) {
    const hit = resolveFile(spec, fromOld);
    if (!hit) return spec;
    const target = fileMoves.get(hit.file) ?? hit.file;
    if (target === hit.file && fromOld === fromNew) return spec;
    const bare = hit.ext ? target.slice(0, target.length - hit.ext.length) : target;
    if (spec.startsWith('@/')) return `@/${bare}`;
    let rel = posix.relative(posix.dirname(fromNew), bare);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
}

// ---------------------------------------------------------------- links

const SKIP = [/^app\/api\//, /^lib\/api\//, /^lib\/legacy\//, /^ci\//, /^docs\//, /^specs\//, /^tests\//, /^scripts\//,
    /^lib\/tasks\/pages\.test\.ts$/, // generic fixtures of the page-to-task matcher, not links
];

/** Old address hit by a literal's path, or null. */
function linkHit(path) {
    const segments = path.split('/');
    // A `${...}` segment fits a placeholder only: hide its text from the fixed comparison.
    const probe = segments.map(s => (s.includes('${') ? '\u0000' : s)).join('/');
    const hit = findEntry(entries, probe);
    if (!hit) return null;
    // A hidden segment must sit on a placeholder.
    const values = {};
    const want = hit.entry.old.split('/');
    for (let i = 0; i < want.length; i++) {
        const m = /^\[([a-z]+)\]$/.exec(want[i]);
        if (m) values[m[1]] = segments[i];
        else if (segments[i] !== want[i]) return null;
    }
    return { entry: hit.entry, to: fillPattern(hit.entry.new, values) };
}

/** Split a literal's text into its path and the query or fragment after it (outside `${}`). */
function splitTail(text) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('${', i)) depth++;
        else if (text[i] === '}' && depth > 0) depth--;
        else if (depth === 0 && (text[i] === '?' || text[i] === '#')) return [text.slice(0, i), text.slice(i)];
    }
    return [text, ''];
}

const OLD_ROOTS = [...new Set(entries.map(e => e.old.split('/')[1]))];
const looksOld = text => OLD_ROOTS.some(r => text === `/${r}` || text.startsWith(`/${r}/`));
const report = { rewrites: [], review: [] };

function processSource(fromOld, fromNew, text) {
    const sf = ts.createSourceFile(fromOld, text, ts.ScriptTarget.Latest, true, fromOld.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    const line = pos => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const linksToo = !SKIP.some(re => re.test(fromOld));
    const visit = node => {
        // Imports: import ... from 'x', export ... from 'x', import('x'), require('x').
        let spec = null;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier;
        if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) spec = node.arguments[0];
        if (spec) {
            const next = rewriteImport(spec.text, fromOld, fromNew);
            if (next !== spec.text) edits.push({ start: spec.getStart(sf) + 1, end: spec.getEnd() - 1, text: next, kind: 'import', from: spec.text });
            return;
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['mock', 'doMock'].includes(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const s = node.arguments[0];
            const next = rewriteImport(s.text, fromOld, fromNew);
            if (next !== s.text) edits.push({ start: s.getStart(sf) + 1, end: s.getEnd() - 1, text: next, kind: 'import', from: s.text });
        }
        if (linksToo && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))) {
            const start = node.getStart(sf) + 1;
            const end = node.getEnd() - 1;
            const raw = text.slice(start, end);
            if (raw.startsWith('/')) {
                const [path, tail] = splitTail(raw);
                const hit = linkHit(path.length > 1 ? path.replace(/\/+$/, '') : path);
                if (hit && MOVES.has(hit.entry.type)) {
                    edits.push({ start, end, text: hit.to + tail, kind: 'link', from: raw });
                } else if (hit) {
                    report.review.push(`${fromNew}:${line(start)}: ${raw}  (${hit.entry.type} -> ${hit.to})`);
                } else if (looksOld(path)) {
                    report.review.push(`${fromNew}:${line(start)}: ${raw}  (no entry)`);
                }
            }
            if (!ts.isTemplateExpression(node)) return;
        }
        if (linksToo && node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
            const raw = node.getText(sf).replace(/\\\//g, '/');
            if (OLD_ROOTS.some(r => raw.includes(`/${r}/`) || raw.includes(`/${r}$`) || raw.includes(`/${r})`))) {
                report.review.push(`${fromNew}:${line(node.getStart(sf))}: ${node.getText(sf)}  (regex)`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    edits.sort((a, b) => b.start - a.start);
    let out = text;
    for (const e of edits) {
        out = out.slice(0, e.start) + e.text + out.slice(e.end);
        report.rewrites.push(`${fromNew}:${line(e.start)}: [${e.kind}] ${e.from} -> ${e.text}`);
    }
    return out;
}

// ---------------------------------------------------------------- run

const sources = tracked.filter(f => SOURCE.test(f) && !removed.includes(f));
const results = new Map();
for (const file of sources) {
    const to = fileMoves.get(file) ?? file;
    const text = readFileSync(file, 'utf-8');
    const out = processSource(file, to, text);
    if (out !== text) results.set(file, out);
}

if (!DRY) {
    for (const file of removed) git('rm', '-q', file);
    for (const [from, to] of fileMoves) {
        mkdirSync(dirname(to), { recursive: true });
        git('mv', from, to);
    }
    for (const [file, out] of results) writeFileSync(fileMoves.get(file) ?? file, out);
    for (const [from, to] of copies) {
        mkdirSync(dirname(to), { recursive: true });
        copyFileSync(from, to);
        git('add', to);
    }
}

const print = (title, lines) => console.log(`\n== ${title} (${lines.length})\n${lines.join('\n')}`);
print('removed', manifest.removed);
print('boundaries', manifest.boundaries.map(b => `${b.file} -> ${b.to.length === 1 ? 'moved to' : 'copied to'} ${b.to.join(', ')}`));
print('moved files', manifest.moved);
print('rewrites', report.rewrites);
print('for a hand fix', report.review);
console.log(`\n${pageMoves.size} page folders moved, ${removed.filter(f => f.endsWith('page.tsx')).length} pages removed${DRY ? ' (dry run)' : ''}`);
if (existsSync('.next')) console.log('note: delete .next before running tsc (stale route types)');
