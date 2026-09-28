/**
 * Projects the canonical knowledge/ tree into docs/knowledge/ for GitHub Pages.
 *
 * Pages serves only docs/, so knowledge.html cannot fetch ../knowledge/ and needs
 * a copy next to it. The copy is generated, never edited: the document list is
 * read from the data-doc attributes in knowledge.html so the page stays the single
 * place that decides what is published.
 *
 * Usage (from docs/):
 *   node scripts/sync-knowledge.js          rewrite docs/knowledge/
 *   node scripts/sync-knowledge.js --check  exit 1 if the projection has drifted
 */
import { readFileSync, readdirSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = resolve(DOCS_DIR, '..', 'knowledge');
const TARGET_DIR = join(DOCS_DIR, 'knowledge');
const PAGE = join(DOCS_DIR, 'knowledge.html');

export function offeredDocs() {
    const html = readFileSync(PAGE, 'utf8');
    const names = [...html.matchAll(/data-doc="([^"]+)"/g)].map(m => m[1]);
    if (names.length === 0) {
        throw new Error(`No data-doc entries found in ${PAGE}`);
    }
    return [...new Set(names)].map(name => `${name}.md`);
}

export function checkProjection() {
    const expected = offeredDocs();
    const problems = [];
    for (const file of expected) {
        const source = join(SOURCE_DIR, file);
        const target = join(TARGET_DIR, file);
        if (!existsSync(source)) {
            problems.push(`offered by knowledge.html but missing in knowledge/: ${file}`);
        } else if (!existsSync(target)) {
            problems.push(`missing in docs/knowledge/: ${file}`);
        } else if (!readFileSync(source).equals(readFileSync(target))) {
            problems.push(`differs from knowledge/: ${file}`);
        }
    }
    const present = existsSync(TARGET_DIR) ? readdirSync(TARGET_DIR) : [];
    for (const file of present) {
        if (!expected.includes(file)) {
            problems.push(`not offered by knowledge.html: docs/knowledge/${file}`);
        }
    }
    return problems;
}

export function syncProjection() {
    const expected = offeredDocs();
    for (const file of expected) {
        if (!existsSync(join(SOURCE_DIR, file))) {
            throw new Error(`knowledge.html offers ${file}, but knowledge/${file} does not exist`);
        }
    }
    mkdirSync(TARGET_DIR, { recursive: true });
    for (const file of readdirSync(TARGET_DIR)) {
        if (!expected.includes(file)) {
            rmSync(join(TARGET_DIR, file), { recursive: true });
        }
    }
    for (const file of expected) {
        copyFileSync(join(SOURCE_DIR, file), join(TARGET_DIR, file));
    }
    return expected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--check')) {
        const problems = checkProjection();
        if (problems.length > 0) {
            console.error('docs/knowledge/ is out of sync. Run: npm run sync:knowledge');
            problems.forEach(p => console.error(`  - ${p}`));
            process.exit(1);
        }
        console.log('docs/knowledge/ matches knowledge/.');
    } else {
        const written = syncProjection();
        console.log(`Synced ${written.join(', ')} into docs/knowledge/.`);
    }
}
