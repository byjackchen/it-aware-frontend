import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findEntry } from './build';
import { REGISTRY } from './registry';

/**
 * No code outside lib/legacy/ names an old page address: since the pages moved
 * under /tasks/... (lane F4), links go to the new addresses, and only the
 * legacy registry knows the old ones. Comments and tests are not checked; a
 * string, a template (a `${...}` part stands for one segment) or a prefix that
 * ends in a slash is.
 */

const ROOTS = ['app', 'components', 'lib', 'i18n', 'proxy.ts'];
const SKIP = [/^lib\/legacy\//, /\.test\.tsx?$/, /\.d\.ts$/];

/**
 * Literals that are an old page address but not a page link, with the reason.
 * Keyed by `file: literal`.
 */
const ALLOWED: Record<string, string> = {};

const OLD = REGISTRY.entries.filter(entry => entry.type !== 'kept');

/** The old address a literal names, or null. */
function oldAddressIn(text: string): string | null {
    if (!text.startsWith('/')) return null;
    let depth = 0;
    let end = text.length;
    for (let i = 0; i < text.length; i++) {
        if (text.startsWith('${', i)) depth++;
        else if (text[i] === '}' && depth > 0) depth--;
        else if (depth === 0 && (text[i] === '?' || text[i] === '#')) {
            end = i;
            break;
        }
    }
    const path = text.slice(0, end);
    const probe = path
        .split('/')
        .map(segment => (segment.includes('${') ? 'x' : segment))
        .join('/');
    const exact = findEntry(OLD, probe.length > 1 ? probe.replace(/\/+$/, '') : probe);
    if (exact) return exact.entry.old;
    if (probe.length > 1 && probe.endsWith('/')) {
        const prefix = OLD.find(entry => entry.old.startsWith(probe) || findEntry([entry], `${probe}x`));
        if (prefix) return prefix.old;
    }
    return null;
}

/** Every literal in a source file that names an old address, as `line: literal`. */
function oldAddressesInSource(file: string, source: string): string[] {
    const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
            const text = node.getText(sf).slice(1, -1);
            if (oldAddressIn(text)) {
                found.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${text}`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

function sourceFiles(path: string): string[] {
    if (statSync(path).isFile()) return [path];
    return readdirSync(path, { recursive: true, encoding: 'utf-8' })
        .map(file => join(path, file))
        .filter(file => /\.(ts|tsx|mjs)$/.test(file) && !file.includes('node_modules'));
}

describe('old page addresses in the code', () => {
    it('finds an old address in a link, a template, a prefix or a query, and nothing else', () => {
        const sample = [
            "// '/data/workers' in a comment is fine",
            "const a = '/data/workers';",
            'const b = `/data/workers/${oid}?tab=history`;',
            "const c = pathname.startsWith('/knowledge/catalog/');",
            "const d = '/tasks/workers/workers';",
            "const e = '/api/objects/workers';",
            "const f = '/home';",
            "const g = '/ohla-journey/headline';",
        ].join('\n');
        expect(oldAddressesInSource('sample.ts', sample)).toEqual([
            "2: /data/workers",
            '3: /data/workers/${oid}?tab=history',
            '4: /knowledge/catalog/',
            '8: /ohla-journey/headline',
        ]);
        expect(oldAddressIn('/data/workers-archive')).toBeNull();
        expect(oldAddressIn('/auth/config/accounts')).toBeNull();
    });

    it('are named only in lib/legacy/', () => {
        const files = ROOTS.flatMap(sourceFiles).filter(file => !SKIP.some(skip => skip.test(file)));
        expect(files.length).toBeGreaterThan(300);
        const found = files.flatMap(file =>
            oldAddressesInSource(file, readFileSync(file, 'utf-8'))
                .filter(hit => !(`${file}: ${hit.slice(hit.indexOf(': ') + 2)}` in ALLOWED))
                .map(hit => `${file}:${hit}`),
        );
        expect(found).toEqual([]);
    });
});
