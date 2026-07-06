// SPDX-FileCopyrightText: 2026 Mikkel Bergmann
// SPDX-License-Identifier: MIT
//
// Generate Starlight content pages from the repo's canonical sources so the site
// is never a second copy: docs/*.md, CHANGELOG.md and examples/*.podscript stay
// authoritative, and everything under src/content/docs/{reference,guide},
// examples.md, changelog.md and public/llms.txt is produced here (and gitignored).
//
// Run automatically via the `presync`/`predev`/`prebuild` npm hooks. cwd = site/.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Keep in sync with `base` in astro.config.mjs. In-content markdown links are not
// base-prefixed by Astro, so we bake the base into internal links here.
const BASE = '/podscript';
const GITHUB = 'https://github.com/mikkel-bergmann/podscript';

/** Drop a leading SPDX HTML-comment header, if present. */
function stripSpdxHeader(md) {
  return md.replace(/^﻿?\s*<!--[\s\S]*?-->\s*\n/, '');
}

/** Pull the first `# Heading` out as the page title; remove that line from the body. */
function extractTitle(md, fallback) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  if (!m) return { title: fallback, body: md };
  const body = md.slice(0, m.index) + md.slice(m.index + m[0].length);
  return { title: m[1], body: body.replace(/^\s*\n/, '') };
}

/** Rewrite the repo's relative markdown links to site routes / GitHub URLs. */
function rewriteLinks(md) {
  const anchor = '(#[^)]*)?';
  const rules = [
    [new RegExp(`\\]\\((?:\\.\\./)?(?:docs/)?SPEC\\.md${anchor}\\)`, 'g'), `](${BASE}/reference/spec/$1)`],
    [new RegExp(`\\]\\((?:\\.\\./)?(?:docs/)?AUTHORING\\.md${anchor}\\)`, 'g'), `](${BASE}/guide/authoring/$1)`],
    [new RegExp(`\\]\\((?:\\.\\./)?(?:docs/)?GLOSSARY\\.md${anchor}\\)`, 'g'), `](${BASE}/reference/glossary/$1)`],
    [new RegExp(`\\]\\((?:\\.\\./)?CHANGELOG\\.md${anchor}\\)`, 'g'), `](${BASE}/changelog/$1)`],
    [/\]\((?:\.\.\/)?examples\/[^)#]+\)/g, `](${BASE}/examples/)`],
    [/\]\((?:\.\.\/)?LICENSE\.md\)/g, `](${GITHUB}/blob/main/LICENSE.md)`],
    [/\]\((?:\.\.\/)?TRADEMARK\.md\)/g, `](${GITHUB}/blob/main/TRADEMARK.md)`],
  ];
  return rules.reduce((acc, [re, to]) => acc.replace(re, to), md);
}

function write(out, frontmatter, body) {
  mkdirSync(dirname(out), { recursive: true });
  const fm = ['---', ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`), '---', ''].join('\n');
  writeFileSync(out, fm + body.replace(/\s*$/, '') + '\n');
  console.log(`  wrote ${out}`);
}

/** Copy a doc source → Starlight page (strip header, lift title, rewrite links). */
function syncDoc({ src, out, description, fallbackTitle }) {
  const raw = stripSpdxHeader(readFileSync(src, 'utf8'));
  const { title, body } = extractTitle(raw, fallbackTitle);
  write(out, { title, description }, rewriteLinks(body));
}

console.log('sync-docs: generating Starlight pages from canonical sources');

syncDoc({ src: '../docs/SPEC.md', out: 'src/content/docs/reference/spec.md', fallbackTitle: 'Specification', description: 'The normative Podscript v0.2.0 specification.' });
syncDoc({ src: '../docs/AUTHORING.md', out: 'src/content/docs/guide/authoring.md', fallbackTitle: 'Authoring', description: 'A compact, self-contained guide to writing valid .podscript files.' });
syncDoc({ src: '../docs/GLOSSARY.md', out: 'src/content/docs/reference/glossary.md', fallbackTitle: 'Glossary', description: 'Audio production terms and how they map to the language.' });
syncDoc({ src: '../CHANGELOG.md', out: 'src/content/docs/changelog.md', fallbackTitle: 'Changelog', description: 'Notable changes to the Podscript specification.' });

// Examples page: one section per examples/*.podscript, verbatim, highlighted.
const exDir = '../examples';
const exFiles = readdirSync(exDir).filter((f) => f.endsWith('.podscript')).sort();
const exBody = [
  'Runnable sample scripts, kept in sync with the repository’s',
  `[\`examples/\`](${GITHUB}/tree/main/examples) directory.`,
  '',
  ...exFiles.flatMap((f) => {
    const code = readFileSync(`${exDir}/${f}`, 'utf8').replace(/\s*$/, '');
    return [`## ${f}`, '', '```podscript', code, '```', ''];
  }),
].join('\n');
write('src/content/docs/examples.md', { title: 'Examples', description: 'Runnable Podscript sample scripts.' }, exBody);

// AI discoverability: serve the repo's llms.txt from the site.
writeFileSync('public/llms.txt', readFileSync('../llms.txt', 'utf8'));
console.log('  wrote public/llms.txt');
console.log('sync-docs: done');
