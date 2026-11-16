import { escapeHtml as e } from '@/utils/escape';
import { t, type I18nKey } from '@/utils/i18n';
import { calcStats, customKey, isOlderVersion, isScored, thirdPartyKey, type ScoreOptions } from '@/utils/stats';
import type { AnalysisResult, CustomFinding, DeprecationFinding, ElementInfo, PdsUsage } from '@/utils/types';

export type TabId = 'pds' | 'custom' | 'deprecations';

/** Lookup tables for click handlers, rebuilt on every render (avoids long selectors in attributes). */
export interface ActionRegistry {
  elements: ElementInfo[];
  groups: string[][];
}

export function newRegistry(): ActionRegistry {
  return { elements: [], groups: [] };
}

const scoreClass = (pct: number) => (pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'error');

export function renderStats(result: AnalysisResult, accepted: Set<string>, opts: ScoreOptions): string {
  const s = calcStats(result, accepted, opts);
  let versionHtml: string;
  if (result.pdsVersions.length) {
    const rows = result.pdsVersions
      .map((v) => {
        const prefixes = ['<code class="prefix-tag default">p-*</code>']
          .concat(v.prefixes.map((p) => `<code class="prefix-tag">${e(p)}-p-*</code>`))
          .join(' ');
        const outdated = v.version && isOlderVersion(v.version, result.catalogVersion)
          ? ` <span class="badge warning">${e(t('version.outdated', { latest: result.catalogVersion }))}</span>`
          : '';
        return `<tr><td class="ver-cell">${e(v.version ?? t('version.unknown'))}${outdated}</td><td class="prefix-cell">${prefixes}</td></tr>`;
      })
      .join('');
    const cdn = result.cdnUrl ? `<div class="cdn-note">${e(t('version.cdn', { url: result.cdnUrl }))}</div>` : '';
    versionHtml = `
      <div class="version-table-wrap">
        <table class="version-table">
          <thead><tr><th>${e(t('version.version'))}</th><th>${e(t('version.prefixes'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${cdn}
      </div>`;
  } else {
    versionHtml = `<div class="version-badge not-found">${e(t('version.notDetected'))}</div>`;
  }

  const cls = scoreClass(s.compliance);
  const formula = t('stats.formula', {
    pds: `<span class="success">${s.pdsInstances}</span>`,
    total: `<span class="neutral">${s.totalInstances}</span>`,
    pct: `<span class="${cls}">${s.compliance}%</span>`,
  });
  return `
    ${versionHtml}
    <div class="stat">
      <div class="stat-value neutral">${s.totalInstances}</div>
      <div>${e(t('stats.uiElements'))}</div>
    </div>
    <div class="stat">
      <div class="stat-value ${cls}">${s.compliance}%</div>
      <div>${e(t('stats.compliance'))}</div>
    </div>
    <div class="stat full-width compliance-formula">
      <div>${formula}</div>
      ${s.ignoredHidden || s.ignoredWidgets
        ? `<div class="scan-note">${e(t('stats.ignored', { hidden: s.ignoredHidden, widgets: s.ignoredWidgets }))}</div>`
        : ''}
      <div class="scan-note">${e(t('stats.scanned', {
        elements: result.scanned.elements,
        shadow: result.scanned.shadowRoots,
        catalog: result.catalogVersion,
      }))}</div>
    </div>
    <div class="stat full-width score-options">
      <label><input type="checkbox" data-option="includeHidden"${opts.includeHidden ? ' checked' : ''}> ${e(t('opts.includeHidden'))}</label>
      <label><input type="checkbox" data-option="includeWidgets"${opts.includeWidgets ? ' checked' : ''}> ${e(t('opts.includeWidgets'))}</label>
    </div>
  `;
}

export function renderTabLabels(result: AnalysisResult, accepted: Set<string>, opts: ScoreOptions): Record<TabId, string> {
  const s = calcStats(result, accepted, opts);
  return {
    pds: `${e(t('tab.pds'))} <span class="tab-count success">${s.pdsInstances}</span>`,
    custom: `${e(t('tab.custom'))} <span class="tab-count warning">${s.nonPdsInstances}</span>`,
    deprecations: `${e(t('tab.deprecations'))} <span class="tab-count info">${s.deprecations}</span>`,
  };
}

export function renderTab(result: AnalysisResult, tab: TabId, accepted: Set<string>, opts: ScoreOptions, reg: ActionRegistry): string {
  if (tab === 'pds') return renderPds(result.pdsUsage);
  if (tab === 'custom') return renderCustom(result, accepted, opts, reg);
  return renderDeprecations(result, reg);
}

// ---------- PDS tab ----------

function usageBadges(u: PdsUsage): string {
  const badges: string[] = [];
  if (u.removedInV4) badges.push(`<span class="badge error">${e(t('badge.removedInV4'))}</span>`);
  if (u.deprecated) badges.push(`<span class="badge warning">${e(t('badge.deprecated'))}</span>`);
  if (u.experimental) badges.push(`<span class="badge info">${e(t('badge.experimental'))}</span>`);
  if (u.unknown) badges.push(`<span class="badge neutral">${e(t('badge.unknown'))}</span>`);
  return badges.join('');
}

function usageRow(u: PdsUsage): string {
  const name = u.tag === u.base ? `&lt;${e(u.tag)}&gt;` : `&lt;${e(u.tag)}&gt; <span class="el-arrow">→</span> ${e(u.base)}`;
  return `
    <div class="component-item">
      <div class="component-header">
        <span class="component-name">${name}${usageBadges(u)}${u.visibleCount < u.count ? `<span class="badge neutral">${e(t('pds.visible', { n: u.visibleCount }))}</span>` : ''}</span>
        <span class="component-count">${u.count}</span>
      </div>
    </div>`;
}

function renderPds(usage: PdsUsage[]): string {
  const top = usage.filter((u) => u.kind === 'component');
  const sub = usage.filter((u) => u.kind === 'sub');
  if (!top.length && !sub.length) return `<div class="empty-state">${e(t('pds.empty'))}</div>`;
  let html = top.map(usageRow).join('');
  if (sub.length) {
    html += `
      <details class="component-item custom-group sub-group">
        <summary class="custom-group-header">
          <div class="custom-group-title">
            <span class="custom-type-name">${e(t('pds.subcomponents'))}</span>
            <span class="component-count neutral-count">${sub.reduce((n, u) => n + u.count, 0)}</span>
          </div>
        </summary>
        <div class="custom-group-body">${sub.map(usageRow).join('')}</div>
      </details>`;
  }
  return html;
}

// ---------- Element card ----------

function elementCard(info: ElementInfo, reg: ActionRegistry, opts: { recTags?: string; acceptKey?: string; accepted?: boolean; extra?: string }): string {
  const idx = reg.elements.push(info) - 1;
  const attrs = Object.entries(info.attributes).map(([k, v]) => `${e(k)}="${e(v)}"`).join(' ');
  const badges = [
    info.inShadowDom ? `<span class="badge neutral">${e(t('badge.shadow'))}</span>` : '',
    info.visible ? '' : `<span class="badge neutral">${e(t('badge.hidden'))}</span>`,
  ].join('');
  const rows: string[] = [];
  rows.push(`<div class="el-row-main"><span class="el-tag-badge">&lt;${e(info.tag)}${attrs ? ' ' + attrs : ''}&gt;</span>${opts.recTags ? `<span class="el-arrow">→</span>${opts.recTags}` : ''}${badges}</div>`);
  if (opts.extra) rows.push(opts.extra);
  if (info.text) rows.push(detail(t('custom.label'), `"${e(info.text)}"`));
  if (info.id) rows.push(detail(t('custom.id'), `#${e(info.id)}`, 'el-id'));
  if (info.classes) rows.push(detail(t('custom.class'), e(info.classes), 'el-classes'));
  rows.push(`<div class="el-detail"><span class="el-detail-label">${e(t('custom.selector'))}</span><code class="selector-code" tabindex="0" data-copy="${idx}" title="${e(t('custom.copy'))}">${e(info.consoleExpr)}</code><button class="highlight-btn" data-highlight="${idx}" title="${e(t('custom.highlight'))}" aria-label="${e(t('custom.highlight'))}">🔍</button></div>`);
  if (opts.acceptKey) {
    rows.push(`<button class="exclude-el-btn${opts.accepted ? ' active' : ''}" data-accept="${idx}">${e(opts.accepted ? t('custom.reset') : t('custom.accept'))}</button>`);
  }
  return `<div class="dom-info${opts.accepted ? ' excluded' : ''}">${rows.join('')}</div>`;
}

function detail(label: string, valueHtml: string, cls = ''): string {
  return `<div class="el-detail"><span class="el-detail-label">${e(label)}</span><span class="el-detail-value ${cls}">${valueHtml}</span></div>`;
}

const recTags = (recs: string[]) => recs.map((r) => `<code class="rec-tag">${e(r)}</code>`).join(' ');

// ---------- Custom tab ----------

function customGroup(title: string, findings: CustomFinding[], accepted: Set<string>, reg: ActionRegistry, opts: { badges?: string; scored: boolean }): string {
  const keys = findings.map(customKey);
  const acceptedCount = keys.filter((k) => accepted.has(k)).length;
  const allAccepted = opts.scored && acceptedCount === keys.length;
  const active = keys.length - acceptedCount;
  const groupIdx = reg.groups.push(keys) - 1;
  const cards = findings
    .map((f) => elementCard(f.element, reg, {
      recTags: recTags(f.recommendations),
      ...(opts.scored ? { acceptKey: customKey(f), accepted: accepted.has(customKey(f)) } : {}),
    }))
    .join('');
  const bulk = opts.scored && keys.length > 1
    ? `<button class="exclude-bulk-btn${allAccepted ? ' active' : ''}" data-bulk="${groupIdx}">${e(allAccepted ? t('custom.resetAll') : t('custom.acceptAll'))}</button>`
    : '';
  const count = opts.scored ? (active > 0 ? String(active) : '✓') : String(findings.length);
  return `
    <details class="component-item custom-group${allAccepted ? ' excluded' : ''}${opts.scored ? '' : ' not-scored'}">
      <summary class="custom-group-header">
        <div class="custom-group-title">
          <span class="custom-type-name">${e(title)}</span>
          ${opts.badges ?? ''}
          <span class="component-count ${opts.scored ? 'warning-count' : 'neutral-count'}">${count}</span>
        </div>
      </summary>
      <div class="custom-group-body">${cards}${bulk}</div>
    </details>`;
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}

function renderCustom(result: AnalysisResult, accepted: Set<string>, opts: ScoreOptions, reg: ActionRegistry): string {
  if (!result.custom.length && !result.thirdParty.length) return `<div class="empty-state">${e(t('custom.empty'))}</div>`;
  const scored = result.custom.filter((f) => isScored(f, opts));
  const widgetFindings = result.custom.filter((f) => !isScored(f, opts) && f.widget && !opts.includeWidgets);
  const hiddenFindings = result.custom.filter((f) => !isScored(f, opts) && !widgetFindings.includes(f));

  let html = '';
  for (const [group, findings] of groupBy(scored, (f) => f.group)) {
    const first = findings[0]!;
    const badges = [
      first.source === 'aria' ? `<span class="custom-source-badge">${e(t('badge.aria'))}</span>` : '',
      `<span class="custom-source-badge confidence-${first.confidence}">${e(t(`custom.confidence.${first.confidence}` as I18nKey))}</span>`,
    ].join('');
    html += customGroup(t(`group.${group}` as I18nKey), findings, accepted, reg, { badges, scored: true });
  }

  for (const tp of result.thirdParty) {
    const key = thirdPartyKey(tp.tag);
    const isAccepted = accepted.has(key);
    const groupIdx = reg.groups.push([key]) - 1;
    const library = tp.library === 'p-*' ? t('thirdParty.primeng') : tp.library;
    const count = opts.includeHidden ? tp.count : tp.visibleCount;
    html += `
      <details class="component-item custom-group${isAccepted ? ' excluded' : ''}">
        <summary class="custom-group-header">
          <div class="custom-group-title">
            <span class="custom-type-name">&lt;${e(tp.tag)}&gt;</span>
            <span class="custom-source-badge">${e(t('badge.thirdParty'))} · ${e(library)}</span>
            <span class="component-count warning-count">${isAccepted ? '✓' : count}</span>
          </div>
        </summary>
        <div class="custom-group-body">
          <button class="exclude-bulk-btn${isAccepted ? ' active' : ''}" data-bulk="${groupIdx}">${e(isAccepted ? t('custom.reset') : t('custom.accept'))}</button>
        </div>
      </details>`;
  }

  if (widgetFindings.length || hiddenFindings.length) {
    html += `<h2 class="subsection-title">${e(t('custom.notScored'))}</h2>`;
    for (const [widget, findings] of groupBy(widgetFindings, (f) => f.widget!)) {
      html += customGroup(t('custom.widgetGroup', { name: widget }), findings, accepted, reg, {
        badges: `<span class="custom-source-badge">${e(t('badge.thirdParty'))}</span>`,
        scored: false,
      });
    }
    if (hiddenFindings.length) {
      html += customGroup(t('custom.hiddenGroup'), hiddenFindings, accepted, reg, { scored: false });
    }
  }
  return `<div class="component-section">${html}</div>`;
}

// ---------- Deprecations tab ----------

function depTitle(d: DeprecationFinding): string {
  if (d.type === 'removed') return `${t('dep.removed')}: <${d.base}>`;
  if (d.type === 'component') return `${t('dep.component')}: <${d.base}>`;
  if (d.type === 'prop') return `${t('dep.prop')}: <${d.base}> ${d.prop}`;
  return `${t('dep.value')}: <${d.base}> ${d.prop}="${d.value}"`;
}

function renderDeprecations(result: AnalysisResult, reg: ActionRegistry): string {
  if (!result.deprecations.length) return `<div class="empty-state">${e(t('dep.empty'))}</div>`;
  const groups = new Map<string, DeprecationFinding[]>();
  for (const d of result.deprecations) {
    const k = depTitle(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  const order = { removed: 0, component: 1, prop: 2, value: 3 };
  const sorted = [...groups.entries()].sort((a, b) => order[a[1][0]!.type] - order[b[1][0]!.type] || b[1].length - a[1].length);
  let html = `<p class="hint">${e(t('dep.intro', { catalog: result.catalogVersion }))}</p>`;
  for (const [title, findings] of sorted) {
    const d = findings[0]!;
    const severity = d.type === 'removed' ? 'error' : 'warning';
    let extra = '';
    if (d.type === 'removed') {
      extra = detail(t('dep.replacedBy'), d.replacedBy ? `<code class="rec-tag">${e(d.replacedBy)}</code>` : e(t('dep.noReplacement')));
    } else if (d.message) {
      extra = detail(t('dep.note'), e(d.message));
    }
    const cards = findings.map((f) => elementCard(f.element, reg, {})).join('');
    html += `
      <details class="component-item custom-group">
        <summary class="custom-group-header">
          <div class="custom-group-title">
            <span class="custom-type-name">${e(title)}</span>
            <span class="badge ${severity}">${e(t(d.type === 'removed' ? 'badge.removedInV4' : 'badge.deprecated'))}</span>
            <span class="component-count warning-count">${findings.length}</span>
          </div>
        </summary>
        <div class="custom-group-body">${extra}${cards}</div>
      </details>`;
  }
  return `<div class="component-section">${html}</div>`;
}
