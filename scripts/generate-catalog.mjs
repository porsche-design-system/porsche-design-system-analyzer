// Generates utils/pds-catalog.json from the component-meta shipped with
// @porsche-design-system/components-js, so the analyzer never relies on a hand-maintained tag list.
// Run: npm run catalog
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { componentMeta } from '@porsche-design-system/components-js/meta';

const require = createRequire(import.meta.url);
const { version } = JSON.parse(
  readFileSync(require.resolve('@porsche-design-system/components-js/package.json'), 'utf8'),
);

// Components removed in v4.0.0 (CHANGELOG "Removed Components") — still found on v3 sites.
const REMOVED_IN_V4 = {
  'p-button-group': { replacedBy: 'CSS / Tailwind CSS (role="group")' },
  'p-checkbox-wrapper': { replacedBy: 'p-checkbox' },
  'p-radio-button-wrapper': { replacedBy: 'p-radio-group' },
  'p-content-wrapper': { replacedBy: 'Porsche Grid (CSS / Tailwind CSS)' },
  'p-link-tile-model-signature': { replacedBy: '' },
  'p-fieldset-wrapper': { replacedBy: 'p-fieldset' },
  'p-flex': { replacedBy: 'CSS Flexbox / Tailwind CSS' },
  'p-flex-item': { replacedBy: 'CSS Flexbox / Tailwind CSS', sub: true },
  'p-grid': { replacedBy: 'CSS Grid / Tailwind CSS' },
  'p-grid-item': { replacedBy: 'CSS Grid / Tailwind CSS', sub: true },
  'p-headline': { replacedBy: 'p-heading' },
  'p-link-social': { replacedBy: '' },
  'p-marque': { replacedBy: 'p-wordmark / p-crest' },
  'p-select-wrapper': { replacedBy: 'p-select' },
  'p-select-wrapper-dropdown': { replacedBy: 'p-select', internal: true },
  'p-text-field-wrapper': { replacedBy: 'p-input-*' },
  'p-textarea-wrapper': { replacedBy: 'p-textarea' },
  'p-text-list-counter': { replacedBy: '', internal: true },
};

// Components that slot a native element which is part of the component itself
// (e.g. <p-link><a/></p-link>, <p-text-field-wrapper><input/></p-text-field-wrapper>).
const WRAPPING = [
  'p-text-field-wrapper', 'p-textarea-wrapper', 'p-select-wrapper', 'p-checkbox-wrapper',
  'p-radio-button-wrapper', 'p-link', 'p-link-pure', 'p-link-tile', 'p-link-social',
  'p-link-tile-model-signature', 'p-link-tile-product', 'p-crest', 'p-wordmark', 'p-marque',
];

const toKebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function shortDeprecation(description = '') {
  const text = description.replace(/^@deprecated\s*/, '').trim();
  const sentences = text.split(/(?<=\.)\s+/);
  const kept = [];
  for (const s of sentences) {
    if (kept.length && !/(remove|use|deprecat|effect|instead|since|replace)/i.test(s)) break;
    kept.push(s);
  }
  return kept.join(' ');
}

const tags = {};
for (const [tag, meta] of Object.entries(componentMeta)) {
  const entry = {
    kind: meta.isInternal ? 'internal' : meta.requiredParent ? 'sub' : 'component',
  };
  if (meta.isExperimental) entry.experimental = true;
  if (meta.isDeprecated) entry.deprecated = meta.deprecationMessage || 'deprecated';
  if (WRAPPING.includes(tag)) entry.wrapping = true;

  for (const [prop, p] of Object.entries(meta.propsMeta || {})) {
    if (p.isDeprecated) {
      (entry.deprecatedProps ??= []).push({
        prop,
        attr: toKebab(prop),
        message: shortDeprecation(p.description),
        default: p.defaultValue ?? null,
      });
    }
    if (Array.isArray(p.deprecatedValues) && p.deprecatedValues.length) {
      (entry.deprecatedValues ??= []).push({
        prop,
        attr: toKebab(prop),
        values: p.deprecatedValues,
        default: p.defaultValue ?? null,
      });
    }
  }
  tags[tag] = entry;
}

for (const [tag, info] of Object.entries(REMOVED_IN_V4)) {
  tags[tag] = {
    kind: info.internal ? 'internal' : info.sub ? 'sub' : 'component',
    removedInV4: true,
    replacedBy: info.replacedBy,
    ...(WRAPPING.includes(tag) ? { wrapping: true } : {}),
  };
}

const sorted = Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)));
const out = fileURLToPath(new URL('../utils/pds-catalog.json', import.meta.url));
writeFileSync(out, JSON.stringify({ version, tags: sorted }, null, 2) + '\n');
console.log(`PDS catalog ${version}: ${Object.keys(sorted).length} tags → utils/pds-catalog.json`);
