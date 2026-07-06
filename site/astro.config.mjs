// SPDX-FileCopyrightText: 2026 Mikkel Bergmann
// SPDX-License-Identifier: MIT
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Custom TextMate grammar so ```podscript code blocks highlight everywhere.
const podscriptGrammar = JSON.parse(
  readFileSync(fileURLToPath(new URL('./grammars/podscript.tmLanguage.json', import.meta.url)), 'utf8'),
);

const GITHUB = 'https://github.com/mikkel-bergmann/podscript';

// https://astro.build/config
export default defineConfig({
  // Served at the root of the custom domain (site/public/CNAME). If you ever revert
  // to project GitHub Pages, set base: '/podscript' and BASE in scripts/sync-docs.mjs.
  site: 'https://podscript.dev',
  integrations: [
    starlight({
      title: 'Podscript',
      description: 'Podcasts as code — write your episode as one plain-text file and compile it to identical audio every time.',
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: GITHUB }],
      // No editLink: pages are generated from ../docs by scripts/sync-docs.mjs, so a
      // per-page edit URL would point at a gitignored file. Edit the canonical docs/ instead.
      expressiveCode: {
        // Register the language; fenced ```podscript blocks pick it up.
        shiki: { langs: [podscriptGrammar] },
      },
      sidebar: [
        { label: 'Guide', items: [{ label: 'Authoring cheatsheet', slug: 'guide/authoring' }] },
        {
          label: 'Reference',
          items: [
            { label: 'Specification', slug: 'reference/spec' },
            { label: 'Glossary', slug: 'reference/glossary' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Examples', slug: 'examples' },
            { label: 'Changelog', slug: 'changelog' },
          ],
        },
      ],
    }),
  ],
});
