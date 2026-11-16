import './style.css';
import catalog from '@/utils/pds-catalog.json';
import { analyzePage } from '@/utils/analyze-page';
import { escapeHtml } from '@/utils/escape';
import { highlightOnPage } from '@/utils/highlight';
import { getLang, initLang, onLangChange, setLang, t, type I18nKey, type Lang } from '@/utils/i18n';
import { customKey, DEFAULT_SCORE_OPTIONS, type ScoreOptions } from '@/utils/stats';
import type { AnalysisResult, PdsCatalog } from '@/utils/types';
import { newRegistry, renderStats, renderTab, renderTabLabels, type TabId } from './render';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const status = $('status');
const analyzeBtn = $<HTMLButtonElement>('analyzeBtn');
const quickStats = $('quickStats');
const tabContainer = $('tabContainer');
const tabContent = $('tabContent');

let result: AnalysisResult | null = null;
let currentTabId: number | null = null;
let activeTab: TabId = 'pds';
let registry = newRegistry();
const accepted = new Set<string>();
const OPTIONS_KEY = 'pds-analyzer-score-options';
const scoreOptions: ScoreOptions = loadScoreOptions();

function loadScoreOptions(): ScoreOptions {
  try {
    return { ...DEFAULT_SCORE_OPTIONS, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SCORE_OPTIONS };
  }
}

$('extVersion').textContent = browser.runtime.getManifest().version;
initLang(browser.i18n?.getUILanguage?.() ?? navigator.language);

// ---------- i18n ----------

function applyStaticTexts() {
  document.documentElement.lang = getLang();
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as I18nKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel as I18nKey));
  });
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === getLang()));
  });
  if (!result) {
    tabContainer.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
      btn.textContent = t(`tab.${btn.dataset.tab}` as I18nKey);
    });
  }
}

document.querySelector('.lang-switch')!.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.lang-btn');
  if (btn?.dataset.lang) setLang(btn.dataset.lang as Lang);
});

onLangChange(() => {
  applyStaticTexts();
  if (result) renderAll();
});

applyStaticTexts();

// ---------- Status ----------

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function showStatus(message: string, type: 'loading' | 'error' | 'success', duration = 4000) {
  if (statusTimer) clearTimeout(statusTimer);
  status.innerHTML = `<span class="status-text">${escapeHtml(message)}</span><button class="status-close" aria-label="${escapeHtml(t('status.close'))}">✕</button>`;
  status.className = `status ${type}`;
  status.style.display = 'flex';
  if (duration > 0) statusTimer = setTimeout(hideStatus, duration);
}

function hideStatus() {
  if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
  status.style.display = 'none';
}

status.addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).classList.contains('status-close')) hideStatus();
});

// ---------- Rendering ----------

function renderAll(animate = false) {
  if (!result) return;
  quickStats.classList.toggle('animate', animate);
  quickStats.innerHTML = renderStats(result, accepted, scoreOptions);
  quickStats.style.display = 'grid';
  tabContainer.style.display = '';
  const labels = renderTabLabels(result, accepted, scoreOptions);
  tabContainer.querySelectorAll<HTMLElement>('.tab-btn').forEach((btn) => {
    const id = btn.dataset.tab as TabId;
    btn.innerHTML = labels[id];
    btn.classList.toggle('active', id === activeTab);
    btn.setAttribute('aria-selected', String(id === activeTab));
  });
  // Keep expanded groups open across re-renders (accept/reset, language switch)
  const openIdx = new Set<number>();
  tabContent.querySelectorAll('details').forEach((d, i) => { if (d.open) openIdx.add(i); });
  registry = newRegistry();
  tabContent.innerHTML = renderTab(result, activeTab, accepted, scoreOptions, registry);
  tabContent.querySelectorAll('details').forEach((d, i) => { if (openIdx.has(i)) d.open = true; });
}

tabContainer.querySelector('.tab-bar')!.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('.tab-btn');
  if (!btn?.dataset.tab || !result) return;
  activeTab = btn.dataset.tab as TabId;
  tabContent.innerHTML = '';
  renderAll();
});

quickStats.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  const option = input.dataset.option as keyof ScoreOptions | undefined;
  if (!option) return;
  scoreOptions[option] = input.checked;
  try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(scoreOptions)); } catch { /* storage unavailable */ }
  renderAll();
});

// ---------- Analysis ----------

analyzeBtn.addEventListener('click', async () => {
  const tabId = chrome.devtools.inspectedWindow.tabId;
  if (!tabId) {
    showStatus(t('status.noTab'), 'error');
    return;
  }
  currentTabId = tabId;
  showStatus(t('status.analyzing'), 'loading', 0);
  analyzeBtn.disabled = true;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: analyzePage,
      args: [catalog as PdsCatalog],
    });
    const data = injection?.result as AnalysisResult | undefined;
    if (!data) {
      showStatus(t('status.failed'), 'error');
      return;
    }
    result = data;
    accepted.clear();
    activeTab = 'pds';
    tabContent.innerHTML = '';
    renderAll(true);
    if (data.error) showStatus(t('status.error', { message: data.error }), 'error', 8000);
    else showStatus(t('status.done', { host: data.host }), 'success');
  } catch (error) {
    showStatus(t('status.error', { message: (error as Error).message }), 'error', 8000);
  } finally {
    analyzeBtn.disabled = false;
  }
});

// ---------- Actions (event delegation) ----------

tabContent.addEventListener('click', (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-highlight], [data-copy], [data-accept], [data-bulk]');
  if (!target) return;
  const { highlight, copy, accept, bulk } = target.dataset;

  if (highlight !== undefined) {
    const info = registry.elements[Number(highlight)];
    if (info) highlightElement(info.locator);
  } else if (copy !== undefined) {
    const info = registry.elements[Number(copy)];
    if (info) copyToClipboard(info.consoleExpr);
  } else if (accept !== undefined && result) {
    const info = registry.elements[Number(accept)];
    const finding = info && result.custom.find((f) => f.element === info);
    if (finding) toggle([customKey(finding)]);
  } else if (bulk !== undefined) {
    const keys = registry.groups[Number(bulk)];
    if (keys) toggle(keys);
  }
});

tabContent.addEventListener('keydown', (ev) => {
  const target = ev.target as HTMLElement;
  if ((ev.key === 'Enter' || ev.key === ' ') && target.dataset.copy !== undefined) {
    ev.preventDefault();
    target.click();
  }
});

function toggle(keys: string[]) {
  const allAccepted = keys.every((k) => accepted.has(k));
  for (const k of keys) {
    if (allAccepted) accepted.delete(k);
    else accepted.add(k);
  }
  renderAll();
}

async function highlightElement(locator: string[]) {
  if (!currentTabId) return;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId: currentTabId },
      func: highlightOnPage,
      args: [locator],
    });
    const res = injection?.result as { found: boolean; visible: boolean } | undefined;
    if (!res?.found) showStatus(t('status.notFound'), 'error');
    else if (!res.visible) showStatus(t('status.hidden'), 'loading', 6000);
  } catch {
    showStatus(t('status.highlightFailed'), 'error');
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => showStatus(t('status.copied'), 'success', 2000))
    .catch(() => showStatus(t('status.copyFailed'), 'error'));
}
