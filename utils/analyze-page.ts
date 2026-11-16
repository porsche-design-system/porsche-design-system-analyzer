import type {
  AnalysisResult,
  Confidence,
  CustomFinding,
  CustomGroupId,
  DeprecationFinding,
  ElementInfo,
  PdsCatalog,
  PdsCatalogEntry,
  PdsUsage,
  PdsVersionInfo,
  ThirdPartyUsage,
} from './types';

/**
 * Injected into the inspected page via `scripting.executeScript({ func, args: [catalog] })`.
 * Must stay self-contained: no references to module scope, only type imports.
 */
export function analyzePage(catalog: PdsCatalog): AnalysisResult {
  const THIRD_PARTY: [string, string][] = [
    ['mat-', 'Angular Material'], ['mdc-', 'Material (MDC)'], ['md-', 'Material Web'],
    ['sl-', 'Shoelace'], ['wa-', 'Web Awesome'], ['ion-', 'Ionic'], ['v-', 'Vuetify'], ['el-', 'Element'],
    ['chakra-', 'Chakra UI'], ['mantine-', 'Mantine'], ['ant-', 'Ant Design'], ['bp-', 'Blueprint'],
    ['bp5-', 'Blueprint'], ['vaadin-', 'Vaadin'], ['fast-', 'FAST'], ['fluent-', 'Fluent UI'],
    ['calcite-', 'Calcite'], ['carbon-', 'Carbon'], ['cds-', 'Carbon / Clarity'], ['ui5-', 'UI5'],
    ['sp-', 'Spectrum'], ['pf-', 'PatternFly'], ['swiper-', 'Swiper'], ['kendo-', 'Kendo UI'],
    ['ix-', 'Siemens iX'], ['igc-', 'Ignite UI'],
  ];
  // Unregistered p-* tags are not PDS (PDS always defines its custom elements), most likely PrimeNG.
  const P_UNREGISTERED = 'p-*';
  const CAROUSEL_CLASS = /(^|\s)(swiper|slick-slider|splide|glide|keen-slider|owl-carousel|flickity-enabled|embla)(\s|$)/;
  const PAGINATION_HINT = /pagin|pager|seite|page/i;
  const INPUT_TYPES = ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'month', 'week'];
  // Embedded third-party widgets, identified by their root container.
  const WIDGETS: [string, string][] = [
    ['.cn-wid-cont, [class*="cn-www-widget"]', 'CarNow'],
    ['.stry-widget, #stry-wrapper', 'Stry'],
    ['#onetrust-consent-sdk, #onetrust-banner-sdk, #onetrust-pc-sdk', 'OneTrust'],
    ['#usercentrics-root, #usercentrics-cmp-ui', 'Usercentrics'],
    ['#CybotCookiebotDialog', 'Cookiebot'],
    ['#didomi-host', 'Didomi'],
    ['#truste-consent-track, .truste_box_overlay', 'TrustArc'],
    ['#intercom-container, .intercom-lightweight-app', 'Intercom'],
    ['#drift-widget-container', 'Drift'],
    ['[id^="LPMcontainer"]', 'LivePerson'],
    ['.embeddedServiceHelpButton, .embeddedServiceSidebar', 'Salesforce Chat'],
    ['[id^="gubagoo"], .gg-app', 'Gubagoo'],
    ['#podium-website-widget, #podium-bubble', 'Podium'],
    ['#hubspot-messages-iframe-container', 'HubSpot'],
    ['.grecaptcha-badge', 'reCAPTCHA'],
    ['.gm-style', 'Google Maps'],
    ['.mapboxgl-map', 'Mapbox'],
    ['.leaflet-container', 'Leaflet'],
    ['.trustpilot-widget', 'Trustpilot'],
    ['[class*="eapps-"], [class^="elfsight-app"]', 'Elfsight'],
    ['.juicer-feed', 'Juicer'],
    ['.taggbox, .taggbox-container', 'Taggbox'],
    ['#fb-root, .fb_iframe_widget', 'Facebook'],
  ];
  // Framework helpers that use ARIA roles but are no UI (e.g. route announcers).
  const SKIP_HOSTS = new Set(['next-route-announcer']);

  const esc: (s: string) => string =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape
      : (s) => s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

  // ---------- PDS version detection ----------
  function detectVersions(): { versions: PdsVersionInfo[]; cdnUrl: string | null; apiPresent: boolean } {
    const versions: PdsVersionInfo[] = [];
    let cdnUrl: string | null = null;
    const pds = (document as any).porscheDesignSystem;
    if (!pds) return { versions, cdnUrl, apiPresent: false };
    const isVersionKey = (k: string) => /^\d+\.\d+\.\d+/.test(k);
    try { if (pds.cdn?.url) cdnUrl = String(pds.cdn.url); } catch { /* proxy */ }

    let keys: string[] = [];
    try { keys = Object.keys(JSON.parse(JSON.stringify(pds))).filter(isVersionKey); } catch { /* proxy */ }
    if (!keys.length) try { keys = Object.keys(pds).filter(isVersionKey); } catch { /* proxy */ }
    if (!keys.length) {
      for (let major = 1; major <= 6; major++)
        for (let minor = 0; minor <= 60; minor++)
          for (let patch = 0; patch <= 30; patch++) {
            const v = `${major}.${minor}.${patch}`;
            try { if (pds[v] && typeof pds[v] === 'object') keys.push(v); } catch { /* */ }
          }
    }
    for (const v of keys) {
      try {
        const entry = pds[v];
        const prefixes = Array.isArray(entry?.prefixes) ? entry.prefixes.map(String).filter(Boolean) : [];
        versions.push({ version: v, prefixes });
      } catch { /* */ }
    }
    if (!versions.length) {
      try {
        const single = pds.version?.sdk || pds.version;
        if (single) {
          const prefix = pds.prefix ? String(pds.prefix) : '';
          versions.push({ version: String(single), prefixes: prefix && prefix !== 'p' ? [prefix] : [] });
        }
      } catch { /* */ }
    }
    return { versions, cdnUrl, apiPresent: true };
  }

  const detection = detectVersions();

  // ---------- Tag classification ----------
  type PdsMatch = { base: string; prefix: string; entry: PdsCatalogEntry | null };
  const pdsCache = new Map<Element, PdsMatch | null>();

  function parseTag(tag: string): { base: string; prefix: string; known: boolean } | null {
    if (catalog.tags[tag]) return { base: tag, prefix: '', known: true };
    let idx = tag.indexOf('-p-');
    while (idx > 0) {
      const base = tag.slice(idx + 1);
      if (catalog.tags[base]) return { base, prefix: tag.slice(0, idx), known: true };
      idx = tag.indexOf('-p-', idx + 1);
    }
    if (tag.startsWith('p-')) return { base: tag, prefix: '', known: false };
    idx = tag.indexOf('-p-');
    if (idx > 0) return { base: tag.slice(idx + 1), prefix: tag.slice(0, idx), known: false };
    return null;
  }

  function isRegistered(el: Element): boolean {
    try { return !!el.shadowRoot || !!customElements.get(el.localName); } catch { return !!el.shadowRoot; }
  }

  function pdsMatch(el: Element): PdsMatch | null {
    if (pdsCache.has(el)) return pdsCache.get(el)!;
    let result: PdsMatch | null = null;
    const parsed = parseTag(el.localName);
    if (parsed && isRegistered(el)) {
      if (parsed.known) result = { base: parsed.base, prefix: parsed.prefix, entry: catalog.tags[parsed.base]! };
      else if (detection.apiPresent) result = { base: parsed.base, prefix: parsed.prefix, entry: null };
    }
    pdsCache.set(el, result);
    return result;
  }

  function thirdPartyLibrary(el: Element): string | null {
    const tag = el.localName;
    if (!tag.includes('-') || pdsMatch(el)) return null;
    for (const [prefix, lib] of THIRD_PARTY) if (tag.startsWith(prefix)) return lib;
    if (tag.startsWith('p-') && !isRegistered(el)) return P_UNREGISTERED;
    return null;
  }

  // ---------- DOM walk incl. open shadow roots of non-PDS / non-library hosts ----------
  const all: Element[] = [];
  let shadowRoots = 0;
  function walk(root: Document | ShadowRoot) {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      all.push(el);
      const sr = el.shadowRoot;
      if (sr && !pdsMatch(el) && !thirdPartyLibrary(el)) {
        shadowRoots++;
        walk(sr);
      }
    }
  }
  walk(document);

  // ---------- Helpers ----------
  function parentAcrossShadow(el: Element): Element | null {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }

  function insidePds(el: Element): boolean {
    let cur = parentAcrossShadow(el);
    while (cur) {
      if (pdsMatch(cur)) return true;
      cur = parentAcrossShadow(cur);
    }
    return false;
  }

  const widgetCache = new Map<Element, string | null>();
  function widgetOf(el: Element): string | null {
    const chain: Element[] = [];
    let cur: Element | null = el;
    let found: string | null = null;
    while (cur) {
      if (widgetCache.has(cur)) { found = widgetCache.get(cur)!; break; }
      chain.push(cur);
      for (const [selector, name] of WIDGETS) {
        try { if (cur.matches(selector)) { found = name; break; } } catch { /* invalid selector */ }
      }
      if (found) break;
      cur = parentAcrossShadow(cur);
    }
    for (const c of chain) widgetCache.set(c, found);
    return found;
  }

  function inSkippedHost(el: Element): boolean {
    let cur: Element | null = el;
    while (cur) {
      if (SKIP_HOSTS.has(cur.localName)) return true;
      cur = parentAcrossShadow(cur);
    }
    return false;
  }

  /** Native element that is part of a PDS wrapper or a third-party component (not separately counted). */
  function isOwned(el: Element): boolean {
    let cur = el.parentElement;
    for (let depth = 0; cur && depth < 3; depth++, cur = cur.parentElement) {
      const m = pdsMatch(cur);
      if (m?.entry?.wrapping) return true;
      if (thirdPartyLibrary(cur)) return true;
    }
    return false;
  }

  function cssPath(el: Element, root: Document | ShadowRoot): string {
    const unique = (sel: string) => { try { return root.querySelectorAll(sel).length === 1; } catch { return false; } };
    if (el.id && unique(`#${esc(el.id)}`)) return `#${esc(el.id)}`;
    const segs: string[] = [];
    let cur: Element | null = el;
    while (cur) {
      if (cur !== el && cur.id && unique(`#${esc(cur.id)}`)) { segs.unshift(`#${esc(cur.id)}`); break; }
      let seg = esc(cur.localName);
      const siblings: HTMLCollection | undefined = cur.parentElement ? cur.parentElement.children : (cur.parentNode as ParentNode | null)?.children;
      if (siblings) {
        let n = 0; let idx = 0;
        for (const s of Array.from(siblings) as Element[]) if (s.localName === cur.localName) { n++; if (s === cur) idx = n; }
        if (n > 1) seg += `:nth-of-type(${idx})`;
      }
      segs.unshift(seg);
      cur = cur.parentElement;
    }
    for (const keep of [1, 2, 4, 7]) {
      if (segs.length <= keep) break;
      const candidate = segs.slice(-keep).join(' > ');
      try { if (unique(candidate) && root.querySelector(candidate) === el) return candidate; } catch { /* */ }
    }
    return segs.join(' > ');
  }

  function locate(el: Element): string[] {
    const parts: string[] = [];
    let node: Element = el;
    for (;;) {
      const root = node.getRootNode() as Document | ShadowRoot;
      parts.unshift(cssPath(node, root));
      if (root instanceof ShadowRoot) node = root.host; else break;
    }
    return parts;
  }

  /** Rendered and perceivable: not display:none / visibility:hidden and not a 1×1px screen-reader-only helper. */
  function isVisible(el: Element): boolean {
    const anyEl = el as any;
    if (typeof anyEl.checkVisibility === 'function') {
      if (!anyEl.checkVisibility({ visibilityProperty: true })) return false;
    } else {
      const h = el as HTMLElement;
      if (!(h.offsetParent || h.offsetWidth || h.offsetHeight)) return false;
    }
    const style = getComputedStyle(el);
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || /^inset\(50%/.test(style.clipPath)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 && rect.height <= 1) {
      // Hosts with display:contents have no box of their own – fall back to their children
      return style.display === 'contents' && Array.from(el.children).some((c) => c.getBoundingClientRect().width > 1);
    }
    return true;
  }

  function labelText(el: Element): string {
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      const label = el.labels?.[0]?.textContent?.trim();
      if (label) return label;
      return el.getAttribute('placeholder') || el.getAttribute('name') || '';
    }
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function info(el: Element): ElementInfo {
    const attributes: Record<string, string> = {};
    for (const a of ['type', 'href', 'role', 'name', 'placeholder', 'aria-label', 'aria-expanded', 'aria-controls', 'aria-modal', 'data-testid']) {
      const v = el.getAttribute(a);
      if (v) attributes[a] = v.length > 80 ? `${v.slice(0, 80)}…` : v;
    }
    const locator = locate(el);
    const consoleExpr = locator
      .map((sel, i) => (i === 0 ? `document.querySelector(${JSON.stringify(sel)})` : `.shadowRoot.querySelector(${JSON.stringify(sel)})`))
      .join('');
    const text = labelText(el);
    return {
      tag: el.localName,
      classes: typeof el.className === 'string' ? el.className.trim() : '',
      id: el.id || '',
      text: text.length > 40 ? `${text.slice(0, 40)}…` : text,
      attributes,
      locator,
      consoleExpr,
      inShadowDom: locator.length > 1,
      visible: isVisible(el),
    };
  }

  // ---------- Result containers ----------
  const usage = new Map<string, PdsUsage>();
  const deprecations: DeprecationFinding[] = [];
  const custom: CustomFinding[] = [];
  const thirdParty = new Map<string, ThirdPartyUsage>();
  const consumed = new WeakSet<Element>();

  function addCustom(el: Element, group: CustomGroupId, recommendations: string[], confidence: Confidence, source: 'html' | 'aria') {
    const widget = widgetOf(el);
    custom.push({ group, source, confidence, recommendations, element: info(el), ...(widget ? { widget } : {}) });
  }

  function consumeTree(el: Element) {
    consumed.add(el);
    el.querySelectorAll('*').forEach((c) => consumed.add(c));
  }

  // ---------- Deprecation checks on PDS instances ----------
  function tokens(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s.trim().startsWith('{') ? s.match(/[A-Za-z0-9_-]+/g) || [] : [s];
  }

  function checkDeprecations(el: Element, m: PdsMatch) {
    const entry = m.entry;
    if (!entry || entry.kind === 'internal') return;
    if (entry.kind === 'component' && entry.removedInV4) {
      deprecations.push({ type: 'removed', tag: el.localName, base: m.base, replacedBy: entry.replacedBy, element: info(el) });
    } else if (entry.kind === 'component' && entry.deprecated) {
      deprecations.push({ type: 'component', tag: el.localName, base: m.base, message: entry.deprecated, element: info(el) });
    }
    const anyEl = el as any;
    for (const p of entry.deprecatedProps || []) {
      const attr = el.getAttribute(p.attr);
      let prop: unknown;
      try { prop = anyEl[p.prop]; } catch { prop = undefined; }
      const propSet = prop !== undefined && prop !== null && prop !== '' && JSON.stringify(prop) !== JSON.stringify(p.default);
      if (attr !== null || propSet) {
        deprecations.push({ type: 'prop', tag: el.localName, base: m.base, prop: p.attr, message: p.message, element: info(el) });
      }
    }
    for (const dv of entry.deprecatedValues || []) {
      let value: unknown = el.getAttribute(dv.attr);
      if (value === null) {
        try { value = anyEl[dv.prop]; } catch { value = undefined; }
        if (JSON.stringify(value) === JSON.stringify(dv.default)) value = undefined;
      }
      const hit = tokens(value).find((t) => dv.values.includes(t));
      if (hit) deprecations.push({ type: 'value', tag: el.localName, base: m.base, prop: dv.attr, value: hit, element: info(el) });
    }
  }

  // ---------- ARIA / pattern detection (runs first so natives can be de-duplicated) ----------
  function detectPatterns() {
    const carousels: Element[] = [];
    for (const el of all) {
      if (consumed.has(el) || pdsMatch(el) || thirdPartyLibrary(el)) continue;
      const role = el.getAttribute('role');
      if (role && inSkippedHost(el)) continue;
      const inPds = () => insidePds(el);

      if (role === 'tablist') {
        if (inPds()) continue;
        addCustom(el, 'tabs', ['p-tabs', 'p-tabs-bar'], 'high', 'aria');
        consumeTree(el);
      } else if (role === 'dialog' || role === 'alertdialog' || el.localName === 'dialog') {
        if (inPds()) continue;
        const modal = el.getAttribute('aria-modal') === 'true';
        addCustom(el, modal ? 'modal' : 'dialog', modal ? ['p-modal', 'p-sheet'] : ['p-modal', 'p-flyout', 'p-sheet'], 'high', 'aria');
        consumed.add(el);
      } else if (role === 'switch') {
        if (inPds()) continue;
        addCustom(el, 'switch', ['p-switch'], 'high', 'aria');
        consumed.add(el);
      } else if (role === 'combobox') {
        if (inPds()) continue;
        addCustom(el, 'combobox', ['p-select', 'p-multi-select'], 'high', 'aria');
        consumed.add(el);
        const listId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
        const list = listId ? (el.getRootNode() as Document | ShadowRoot).getElementById?.(listId) : null;
        if (list) consumeTree(list);
      } else if (role === 'listbox' && el.localName !== 'select') {
        if (inPds()) continue;
        addCustom(el, 'listbox', ['p-select', 'p-multi-select'], 'medium', 'aria');
        consumeTree(el);
      } else if (role === 'alert') {
        if (inPds() || inSkippedHost(el) || !(el.textContent || '').trim()) continue;
        addCustom(el, 'alert', ['p-inline-notification', 'p-banner', 'p-toast'], 'high', 'aria');
        consumed.add(el);
      } else if (role === 'radiogroup') {
        if (inPds()) continue;
        addCustom(el, 'radiogroup', ['p-radio-group'], 'high', 'aria');
        consumeTree(el);
      } else if (role === 'tooltip') {
        if (inPds()) continue;
        addCustom(el, 'tooltip', ['p-popover'], 'medium', 'aria');
        consumed.add(el);
      } else if (role === 'progressbar') {
        if (inPds()) continue;
        if (el.hasAttribute('aria-valuenow')) addCustom(el, 'progress', ['p-stepper-horizontal'], 'low', 'aria');
        else addCustom(el, 'spinner', ['p-spinner'], 'medium', 'aria');
        consumed.add(el);
      } else if (el.localName === 'nav' || role === 'navigation') {
        const hint = `${el.getAttribute('aria-label') || ''} ${typeof el.className === 'string' ? el.className : ''}`;
        if (!PAGINATION_HINT.test(hint) || inPds()) continue;
        let numbers = 0;
        el.querySelectorAll('a, button').forEach((l) => { if (/^\d+$/.test(l.textContent?.trim() || '')) numbers++; });
        if (numbers >= 3) {
          addCustom(el, 'pagination', ['p-pagination'], 'high', 'aria');
          consumeTree(el);
        }
      } else if (
        (el.localName === 'button' || role === 'button') &&
        el.hasAttribute('aria-expanded') && el.hasAttribute('aria-controls') && !el.hasAttribute('aria-haspopup')
      ) {
        if (el.closest('[role="tablist"], details') || inPds()) continue;
        const target = (el.getRootNode() as Document | ShadowRoot).getElementById?.(el.getAttribute('aria-controls')!);
        const targetRole = target?.getAttribute('role');
        if (target && !['dialog', 'menu', 'listbox', 'tree'].includes(targetRole || '')) {
          addCustom(el, 'accordion', ['p-accordion'], 'medium', 'aria');
          consumed.add(el);
        }
      } else if (
        /carousel/i.test(el.getAttribute('aria-roledescription') || '') ||
        (typeof el.className === 'string' && CAROUSEL_CLASS.test(el.className))
      ) {
        if (carousels.some((c) => c.contains(el)) || inPds()) continue;
        carousels.push(el);
        addCustom(el, 'carousel', ['p-carousel'], 'medium', 'aria');
        consumed.add(el);
      }
    }
  }

  function isButtonLikeLink(el: Element): boolean {
    if (el.getAttribute('role') === 'button') return true;
    const href = (el.getAttribute('href') || '').trim();
    if (!href || /^javascript:/i.test(href)) return true;
    return href === '#' && el.hasAttribute('onclick');
  }

  function detectNative(el: Element) {
    const tag = el.localName;
    let group: CustomGroupId | null = null;
    let rec: string[] = [];
    let confidence: Confidence = 'high';

    if (tag === 'button') { group = 'button'; rec = ['p-button', 'p-button-pure']; }
    else if (tag === 'a') { if (isButtonLikeLink(el)) { group = 'buttonLink'; rec = ['p-button', 'p-button-pure']; } }
    else if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (INPUT_TYPES.includes(type)) { group = `input-${type}` as CustomGroupId; rec = [`p-input-${type}`]; }
      else if (type === 'checkbox') { group = 'checkbox'; rec = ['p-checkbox']; }
      else if (type === 'radio') { group = 'radio'; rec = ['p-radio-group']; }
      else if (type === 'submit' || type === 'button' || type === 'reset') { group = 'button'; rec = ['p-button', 'p-button-pure']; }
    }
    else if (tag === 'select') {
      const multiple = (el as HTMLSelectElement).multiple;
      group = multiple ? 'selectMultiple' : 'select';
      rec = multiple ? ['p-multi-select'] : ['p-select'];
    }
    else if (tag === 'textarea') { group = 'textarea'; rec = ['p-textarea']; }
    else if (tag === 'table') { group = 'table'; rec = ['p-table']; }
    else if (tag === 'fieldset') { group = 'fieldset'; rec = ['p-fieldset']; confidence = 'medium'; }
    else if (tag === 'details') { group = 'details'; rec = ['p-accordion']; confidence = 'medium'; }
    else if (tag === 'hr') { group = 'divider'; rec = ['p-divider']; confidence = 'medium'; }

    if (!group || isOwned(el)) return;
    addCustom(el, group, rec, confidence, 'html');
  }

  // ---------- Main ----------
  const result: AnalysisResult = {
    host: location.hostname,
    catalogVersion: catalog.version,
    pdsVersions: detection.versions,
    cdnUrl: detection.cdnUrl,
    pdsUsage: [],
    deprecations,
    custom,
    thirdParty: [],
    scanned: { elements: all.length, shadowRoots },
  };

  try {
    detectPatterns();

    const domPrefixes = new Set<string>();
    for (const el of all) {
      try {
        const m = pdsMatch(el);
        if (m) {
          if (m.entry?.kind === 'internal') continue;
          if (m.prefix) domPrefixes.add(m.prefix);
          const key = el.localName;
          const u = usage.get(key) || {
            tag: key,
            base: m.base,
            kind: m.entry ? m.entry.kind : 'component',
            count: 0,
            visibleCount: 0,
            ...(m.entry?.experimental ? { experimental: true } : {}),
            ...(m.entry?.deprecated ? { deprecated: true } : {}),
            ...(m.entry?.removedInV4 ? { removedInV4: true } : {}),
            ...(m.entry ? {} : { unknown: true }),
          };
          u.count++;
          if (isVisible(el)) u.visibleCount++;
          usage.set(key, u);
          checkDeprecations(el, m);
          continue;
        }
        const lib = thirdPartyLibrary(el);
        if (lib) {
          const t = thirdParty.get(el.localName) || { library: lib, tag: el.localName, count: 0, visibleCount: 0 };
          t.count++;
          if (isVisible(el)) t.visibleCount++;
          thirdParty.set(el.localName, t);
          continue;
        }
        if (!consumed.has(el)) detectNative(el);
      } catch { /* skip element */ }
    }

    if (!result.pdsVersions.length && usage.size) {
      result.pdsVersions = [{ version: null, prefixes: [...domPrefixes] }];
    }
    result.pdsUsage = [...usage.values()].sort((a, b) => b.count - a.count);
    result.thirdParty = [...thirdParty.values()].sort((a, b) => b.count - a.count);
  } catch (error) {
    result.error = (error as Error).message;
  }
  return result;
}
