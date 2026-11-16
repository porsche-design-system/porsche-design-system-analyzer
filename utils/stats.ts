import type { AnalysisResult, CustomFinding } from './types';

export const customKey = (f: CustomFinding) => `c:${f.element.locator.join(' >>> ')}`;
export const thirdPartyKey = (tag: string) => `tp:${tag}`;

export interface ScoreOptions {
  /** Count elements that are not rendered (display:none, visibility:hidden, screen-reader-only) */
  includeHidden: boolean;
  /** Count elements inside embedded third-party widgets (chat, cookie banner, map …) */
  includeWidgets: boolean;
}

export const DEFAULT_SCORE_OPTIONS: ScoreOptions = { includeHidden: false, includeWidgets: false };

export interface Stats {
  pdsInstances: number;
  pdsComponents: number;
  subInstances: number;
  customActive: number;
  thirdPartyActive: number;
  nonPdsInstances: number;
  totalInstances: number;
  compliance: number;
  deprecations: number;
  /** Findings left out of the score because of the options (not because the user accepted them) */
  ignoredHidden: number;
  ignoredWidgets: number;
}

/** Whether a custom finding counts towards the score with the given options (ignores user acceptance). */
export function isScored(f: CustomFinding, opts: ScoreOptions): boolean {
  if (!opts.includeWidgets && f.widget) return false;
  if (!opts.includeHidden && !f.element.visible) return false;
  return true;
}

export function calcStats(result: AnalysisResult, accepted: Set<string>, opts: ScoreOptions = DEFAULT_SCORE_OPTIONS): Stats {
  const n = (u: { count: number; visibleCount: number }) => (opts.includeHidden ? u.count : u.visibleCount);
  const top = result.pdsUsage.filter((u) => u.kind === 'component');
  const pdsInstances = top.reduce((sum, u) => sum + n(u), 0);
  const subInstances = result.pdsUsage.filter((u) => u.kind === 'sub').reduce((sum, u) => sum + n(u), 0);

  let customActive = 0;
  let ignoredHidden = 0;
  let ignoredWidgets = 0;
  for (const f of result.custom) {
    if (!opts.includeWidgets && f.widget) { ignoredWidgets++; continue; }
    if (!opts.includeHidden && !f.element.visible) { ignoredHidden++; continue; }
    if (!accepted.has(customKey(f))) customActive++;
  }
  const thirdPartyActive = result.thirdParty
    .filter((tp) => !accepted.has(thirdPartyKey(tp.tag)))
    .reduce((sum, tp) => sum + n(tp), 0);
  const nonPdsInstances = customActive + thirdPartyActive;
  const totalInstances = pdsInstances + nonPdsInstances;
  return {
    pdsInstances,
    pdsComponents: top.filter((u) => n(u) > 0).length,
    subInstances,
    customActive,
    thirdPartyActive,
    nonPdsInstances,
    totalInstances,
    compliance: totalInstances > 0 ? Math.round((pdsInstances / totalInstances) * 100) : 0,
    deprecations: result.deprecations.length,
    ignoredHidden,
    ignoredWidgets,
  };
}

/** true if `a` is a lower semver than `b` (major.minor.patch, pre-release suffix ignored) */
export function isOlderVersion(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).slice(0, 3).map(Number);
  const pb = b.split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x < y;
  }
  return false;
}
