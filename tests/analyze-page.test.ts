import { beforeEach, describe, expect, it } from 'vitest';
import catalogJson from '../utils/pds-catalog.json';
import { analyzePage } from '../utils/analyze-page';
import type { PdsCatalog } from '../utils/types';
import { calcStats, customKey, type ScoreOptions } from '../utils/stats';

const ALL: ScoreOptions = { includeHidden: true, includeWidgets: true };

const catalog = catalogJson as PdsCatalog;
const registered = new Set<string>();

/** PDS always registers its custom elements – simulate that for the given tags. */
function define(...tags: string[]) {
  for (const tag of tags) {
    if (registered.has(tag)) continue;
    customElements.define(tag, class extends HTMLElement {});
    registered.add(tag);
  }
}

function run(html: string) {
  document.body.innerHTML = html;
  return analyzePage(catalog);
}

const usage = (r: ReturnType<typeof run>, tag: string) => r.pdsUsage.find((u) => u.tag === tag)?.count ?? 0;
const groups = (r: ReturnType<typeof run>) => r.custom.map((c) => c.group).sort();

beforeEach(() => {
  delete (document as any).porscheDesignSystem;
  document.body.innerHTML = '';
});

describe('PDS detection', () => {
  it('counts v4 components from the catalog and separates sub-components', () => {
    define('p-button', 'p-table', 'p-table-head', 'p-table-head-row', 'p-table-head-cell', 'p-table-body', 'p-table-row', 'p-table-cell');
    const r = run(`
      <p-button>Save</p-button>
      <p-table><p-table-head><p-table-head-row><p-table-head-cell>A</p-table-head-cell></p-table-head-row></p-table-head>
      <p-table-body><p-table-row><p-table-cell>1</p-table-cell></p-table-row><p-table-row><p-table-cell>2</p-table-cell></p-table-row></p-table-body></p-table>`);
    expect(usage(r, 'p-button')).toBe(1);
    expect(usage(r, 'p-table')).toBe(1);
    expect(r.pdsUsage.find((u) => u.tag === 'p-table-cell')?.kind).toBe('sub');
    const s = calcStats(r, new Set(), ALL);
    expect(s.pdsInstances).toBe(2);
    expect(s.subInstances).toBe(8);
  });

  it('detects custom prefixes and maps them to the base tag', () => {
    define('icc-p-link-pure');
    const r = run('<icc-p-link-pure><a href="/x">Go</a></icc-p-link-pure>');
    expect(r.pdsUsage[0]).toMatchObject({ tag: 'icc-p-link-pure', base: 'p-link-pure', kind: 'component' });
    expect(r.pdsVersions[0]).toEqual({ version: null, prefixes: ['icc'] });
    expect(r.custom).toHaveLength(0);
  });

  it('does not count natives slotted into PDS wrappers', () => {
    define('p-text-field-wrapper', 'p-checkbox-wrapper', 'p-link');
    const r = run(`
      <p-text-field-wrapper label="Name"><input type="text"></p-text-field-wrapper>
      <p-checkbox-wrapper label="OK"><input type="checkbox"></p-checkbox-wrapper>
      <p-link><a href="javascript:void(0)">Click</a></p-link>`);
    expect(r.custom).toHaveLength(0);
    expect(calcStats(r, new Set(), ALL).pdsInstances).toBe(3);
  });

  it('treats unregistered p-* tags as third-party (PrimeNG) instead of PDS', () => {
    const r = run('<p-dropdown></p-dropdown><p-calendar></p-calendar>');
    expect(r.pdsUsage).toHaveLength(0);
    expect(r.thirdParty.map((t) => t.library)).toEqual(['p-*', 'p-*']);
  });

  it('reads versions and prefixes from document.porscheDesignSystem', () => {
    (document as any).porscheDesignSystem = { '3.29.0': { prefixes: ['phn'] }, '4.10.1': { prefixes: [] }, cdn: { url: 'https://cdn.ui.porsche.com' } };
    const r = run('');
    expect(r.pdsVersions.map((v) => v.version)).toEqual(['3.29.0', '4.10.1']);
    expect(r.pdsVersions[0]!.prefixes).toEqual(['phn']);
    expect(r.cdnUrl).toBe('https://cdn.ui.porsche.com');
  });
});

describe('custom elements', () => {
  it('maps natives to v4 recommendations', () => {
    const r = run(`
      <button>Buy</button><input type="email"><input type="month"><select multiple></select>
      <textarea></textarea><table></table><a href="#" onclick="x()">Fake</a><a href="/real">Real link</a>
      <input type="hidden"><input type="range">`);
    expect(groups(r)).toEqual(['buttonLink', 'button', 'input-email', 'input-month', 'selectMultiple', 'table', 'textarea'].sort());
    expect(r.custom.find((c) => c.group === 'input-email')!.recommendations).toEqual(['p-input-email']);
  });

  it('does not double count elements inside detected ARIA patterns', () => {
    const r = run(`
      <div role="tablist"><button role="tab">A</button><button role="tab">B</button></div>
      <div role="radiogroup"><input type="radio"><input type="radio"></div>
      <nav aria-label="Pagination"><a href="/1">1</a><a href="/2">2</a><a href="/3">3</a></nav>`);
    expect(groups(r)).toEqual(['pagination', 'radiogroup', 'tabs']);
  });

  it('detects accordions only when aria-controls points to a panel', () => {
    const r = run(`
      <button aria-expanded="false" aria-controls="p1">Q</button><div id="p1">A</div>
      <button aria-expanded="false" aria-haspopup="menu" aria-controls="m1">Menu</button><div id="m1" role="menu"></div>`);
    expect(groups(r)).toEqual(['accordion', 'button']);
  });

  it('scans open shadow roots of non-PDS hosts and builds a piercing locator', () => {
    document.body.innerHTML = '<my-widget></my-widget>';
    const host = document.querySelector('my-widget')!;
    host.attachShadow({ mode: 'open' }).innerHTML = '<div><button id="inner">X</button></div>';
    const r = analyzePage(catalog);
    const btn = r.custom.find((c) => c.group === 'button')!;
    expect(btn.element.inShadowDom).toBe(true);
    expect(btn.element.locator).toEqual(['my-widget', '#inner']);
    expect(btn.element.consoleExpr).toBe('document.querySelector("my-widget").shadowRoot.querySelector("#inner")');
    expect(r.scanned.shadowRoots).toBe(1);
  });

  it('accepting a finding removes it from the score', () => {
    define('p-button');
    const r = run('<p-button>A</p-button><button>B</button>');
    expect(calcStats(r, new Set(), ALL).compliance).toBe(50);
    expect(calcStats(r, new Set([customKey(r.custom[0]!)]), ALL).compliance).toBe(100);
  });
});

describe('deprecations', () => {
  it('reports components removed in v4 with replacement', () => {
    define('p-headline', 'p-select-wrapper');
    const r = run('<p-headline>Hi</p-headline><p-select-wrapper><select></select></p-select-wrapper>');
    const removed = r.deprecations.filter((d) => d.type === 'removed');
    expect(removed.map((d) => [d.base, d.replacedBy])).toEqual([['p-headline', 'p-heading'], ['p-select-wrapper', 'p-select']]);
    expect(r.custom).toHaveLength(0);
  });

  it('reports deprecated components, props and values from component-meta', () => {
    define('p-display', 'p-accordion', 'p-text');
    const r = run(`
      <p-display>Big</p-display>
      <p-accordion heading="FAQ"></p-accordion>
      <p-text size="small" weight="semi-bold">t</p-text>
      <p-text size="sm">ok</p-text>`);
    const found = r.deprecations.map((d) => `${d.type}:${d.base}:${d.prop ?? ''}:${d.value ?? ''}`).sort();
    expect(found).toEqual(['component:p-display::', 'prop:p-accordion:heading:', 'value:p-text:size:small', 'value:p-text:weight:semi-bold'].sort());
  });
});

describe('scoring accuracy', () => {
  /** jsdom has no layout: simulate it. [data-hidden] → display:none, .sr-only → 1×1px */
  function withLayout(fn: () => void) {
    const proto = Element.prototype as any;
    const origCheck = proto.checkVisibility;
    const origRect = proto.getBoundingClientRect;
    proto.checkVisibility = function () { return !this.closest('[data-hidden]'); };
    proto.getBoundingClientRect = function () {
      const size = this.classList.contains('sr-only') ? 1 : 100;
      return { width: size, height: size, top: 0, left: 0, right: size, bottom: size, x: 0, y: 0, toJSON() {} };
    };
    try { fn(); } finally { proto.checkVisibility = origCheck; proto.getBoundingClientRect = origRect; }
  }

  it('excludes hidden and screen-reader-only elements by default, for PDS and custom alike', () => {
    define('p-link');
    withLayout(() => {
      const r = run(`
        <p-link><a href="/a">A</a></p-link>
        <nav data-hidden><p-link><a href="/b">B</a></p-link><button>Desktop menu</button></nav>
        <button class="sr-only">Open menu</button>
        <button>Visible</button>`);
      expect(r.pdsUsage[0]).toMatchObject({ count: 2, visibleCount: 1 });
      const s = calcStats(r, new Set());
      expect(s).toMatchObject({ pdsInstances: 1, customActive: 1, ignoredHidden: 2, compliance: 50 });
      expect(calcStats(r, new Set(), { includeHidden: true, includeWidgets: false }).compliance).toBe(40);
    });
  });

  it('assigns findings in embedded third-party widgets and leaves them out by default', () => {
    define('p-button');
    withLayout(() => {
      const r = run(`
        <p-button>Buy</p-button>
        <div class="cn-www-widget429a1b5 cn-wid-cont"><a class="cn-b13-btn">Live Chat</a><input type="text"></div>
        <div id="onetrust-consent-sdk"><button>Accept all</button></div>`);
      expect(r.custom.map((c) => c.widget).sort()).toEqual(['CarNow', 'CarNow', 'OneTrust']);
      expect(calcStats(r, new Set())).toMatchObject({ compliance: 100, ignoredWidgets: 3 });
      expect(calcStats(r, new Set(), { includeHidden: false, includeWidgets: true }).compliance).toBe(25);
    });
  });

  it('ignores empty live regions and framework route announcers', () => {
    document.body.innerHTML = '<div role="alert"></div><div role="alert">Payment failed</div><next-route-announcer></next-route-announcer>';
    document.querySelector('next-route-announcer')!.attachShadow({ mode: 'open' }).innerHTML = '<div role="alert">Home</div>';
    const r = analyzePage(catalog);
    expect(r.custom.map((c) => [c.group, c.element.text])).toEqual([['alert', 'Payment failed']]);
  });
});
