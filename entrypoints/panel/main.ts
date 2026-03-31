import './style.css';

interface DomInfo {
  tag: string;
  classes: string;
  id: string;
  text: string;
  attributes: Record<string, string>;
  xpath: string;
}

interface PatternMatch {
  pattern: string;
  pdsAlternative: string;
  confidence: 'high' | 'medium' | 'low';
  element: DomInfo;
}

interface PdsVersionInfo {
  version: string;
  prefixes: string[];  // e.g. ['p'] (default), ['icc', 'uc', 'phn']
}

interface AnalysisResults {
  pdsVersions: PdsVersionInfo[];
  cdnUrl: string | null;
  designSystem: Record<string, number>;
  standardHtml: Record<string, DomInfo[]>;
  ariaPatterns: PatternMatch[];
  thirdParty: Record<string, number>;
  error?: string;
}

let analysisResults: AnalysisResults | null = null;
let currentTabId: number | null = null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const extVersion = $('extVersion');
const manifest = browser.runtime.getManifest();
extVersion.textContent = manifest.version;

const analyzeBtn = $<HTMLButtonElement>('analyzeBtn');
const status = $('status');
const quickStats = $('quickStats');
const backBtn = $<HTMLButtonElement>('backBtn');
const mainView = $('mainView');
const detailsView = $('detailsView');
const detailsStats = $('detailsStats');
const detailsContent = $('detailsContent');

analyzeBtn.addEventListener('click', async () => {
  try {
    // Get the tab being inspected in DevTools
    const tabId = chrome.devtools.inspectedWindow.tabId;
    if (!tabId) {
      showStatus('Kein aktiver Tab gefunden.', 'error');
      return;
    }

    currentTabId = tabId;
    showStatus('Analysiere Website...', 'loading');
    analyzeBtn.disabled = true;

    const results = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: analyzeCurrentPage,
    });

    if (results?.[0]?.result) {
      analysisResults = results[0].result as AnalysisResults;
      displayQuickStats(analysisResults);
      // Get the inspected page URL for display
      chrome.devtools.inspectedWindow.eval('location.hostname', (hostname: string) => {
        showStatus(`Analyse abgeschlossen für: ${hostname}`, 'success');
      });
    } else {
      showStatus('Fehler bei der Analyse', 'error');
    }
  } catch (error) {
    showStatus(`Fehler: ${(error as Error).message}`, 'error');
  } finally {
    analyzeBtn.disabled = false;
  }
});

backBtn.addEventListener('click', () => {
  mainView.classList.remove('hide');
  detailsView.classList.remove('show');
});

// Click handler for stat boxes — delegated on quickStats
quickStats.addEventListener('click', (e) => {
  const stat = (e.target as HTMLElement).closest('.stat[data-filter]') as HTMLElement | null;
  if (!stat || !analysisResults) return;
  const filter = stat.getAttribute('data-filter') as 'pds' | 'custom';
  if (filter) showFilteredDetails(analysisResults, filter);
});

function showStatus(message: string, type: 'loading' | 'error' | 'success') {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

// Human-readable type names for standard HTML elements
const displayNames: Record<string, string> = {
  'button': 'Button',
  'button[type="submit"]': 'Button',
  'button[type="button"]': 'Button',
  'button[type="reset"]': 'Button',
  'input[type="text"]': 'Text Input',
  'input[type="email"]': 'Email Input',
  'input[type="password"]': 'Password Input',
  'input[type="number"]': 'Number Input',
  'input[type="tel"]': 'Tel Input',
  'input[type="url"]': 'URL Input',
  'input[type="search"]': 'Search Input',
  'input[type="date"]': 'Date Input',
  'input[type="time"]': 'Time Input',
  'input[type="checkbox"]': 'Checkbox',
  'input[type="radio"]': 'Radio Button',
  'select': 'Select / Dropdown',
  'textarea': 'Textarea',
  'a[role="button"]': 'Link als Button',
  'table': 'Table',
};

// PDS recommendations per element mapping key
const pdsRecommendations: Record<string, string[]> = {
  'button': ['p-button', 'p-button-pure'],
  'button[type="submit"]': ['p-button'],
  'button[type="button"]': ['p-button', 'p-button-pure'],
  'button[type="reset"]': ['p-button'],
  'input[type="text"]': ['p-text-field-wrapper (v3)', 'p-input-text (v4)'],
  'input[type="email"]': ['p-text-field-wrapper (v3)', 'p-input-email (v4)'],
  'input[type="password"]': ['p-text-field-wrapper (v3)', 'p-input-password (v4)'],
  'input[type="number"]': ['p-text-field-wrapper (v3)', 'p-input-number (v4)'],
  'input[type="tel"]': ['p-text-field-wrapper (v3)', 'p-input-tel (v4)'],
  'input[type="url"]': ['p-text-field-wrapper (v3)', 'p-input-url (v4)'],
  'input[type="search"]': ['p-text-field-wrapper (v3)', 'p-input-search (v4)'],
  'input[type="date"]': ['p-text-field-wrapper (v3)', 'p-input-date (v4)'],
  'input[type="time"]': ['p-text-field-wrapper (v3)', 'p-input-time (v4)'],
  'input[type="checkbox"]': ['p-checkbox-wrapper (v3)', 'p-checkbox (v4)'],
  'input[type="radio"]': ['p-radio-button-wrapper (v3)', 'p-radio-group (v4)'],
  'select': ['p-select-wrapper (v3)', 'p-select (v4)'],
  'textarea': ['p-textarea-wrapper (v3)', 'p-textarea (v4)'],
  'a[role="button"]': ['p-button', 'p-link'],
  'table': ['p-table'],
};

// ARIA pattern PDS recommendations
const ariaRecommendations: Record<string, string[]> = {
  'Tabs': ['p-tabs'],
  'Modal': ['p-modal'],
  'Dialog': ['p-modal', 'p-flyout'],
  'Toggle Switch': ['p-switch'],
  'Custom Dropdown': ['p-select'],
  'Alert': ['p-inline-notification', 'p-banner'],
  'Accordion': ['p-accordion'],
  'Radio Group': ['p-radio-group'],
  'Pagination': ['p-pagination'],
  'Tooltip': ['p-popover'],
  'Progress / Stepper': ['p-stepper-horizontal'],
};

function showFilteredDetails(data: AnalysisResults, filter: 'pds' | 'custom') {
  mainView.classList.add('hide');
  detailsView.classList.add('show');

  const title = filter === 'pds' ? 'PDS Komponenten' : 'Custom Elemente';
  detailsStats.innerHTML = `<div class="detail-title">${title}</div>`;

  let html = '';
  if (filter === 'pds') {
    if (Object.keys(data.designSystem).length > 0) {
      html += createComponentSection('Design System Komponenten', data.designSystem, 'success');
    }
  } else {
    html += createCustomElementsView(data);
  }

  if (!html) {
    html = `<div class="empty-state">Keine ${title} gefunden</div>`;
  }

  detailsContent.innerHTML = html;
  attachDetailClickHandlers();
}

function createCustomElementsView(data: AnalysisResults): string {
  // Merge all custom elements into one unified view grouped by simplified type
  type CustomGroup = {
    elements: DomInfo[];
    pdsRec: string[];
    source: 'html' | 'aria' | 'thirdparty';
  };
  const groups = new Map<string, CustomGroup>();

  // 1. Standard HTML elements
  for (const [key, items] of Object.entries(data.standardHtml)) {
    if (!Array.isArray(items)) continue;
    const name = displayNames[key] || key;
    const rec = pdsRecommendations[key] || [];
    if (!groups.has(name)) groups.set(name, { elements: [], pdsRec: rec, source: 'html' });
    groups.get(name)!.elements.push(...items);
  }

  // 2. ARIA patterns
  for (const p of data.ariaPatterns) {
    const shortName = p.pattern.replace(/\s*\(.*\)/, '');
    const rec = ariaRecommendations[shortName] || [p.pdsAlternative];
    if (!groups.has(shortName)) groups.set(shortName, { elements: [], pdsRec: rec, source: 'aria' });
    groups.get(shortName)!.elements.push(p.element);
  }

  // 3. Third-party components
  for (const [tag, count] of Object.entries(data.thirdParty)) {
    const name = tag;
    if (!groups.has(name)) groups.set(name, { elements: [], pdsRec: [], source: 'thirdparty' });
    // Third-party only has counts, create placeholder entries
    for (let i = 0; i < (count as number); i++) {
      groups.get(name)!.elements.push({ tag, classes: '', id: '', text: '', attributes: {}, xpath: '' });
    }
  }

  if (groups.size === 0) return '';

  let html = '';
  for (const [name, group] of groups) {
    const sourceLabel = group.source === 'aria' ? 'ARIA Pattern' : group.source === 'thirdparty' ? 'Third-Party' : '';

    const visibleItems = group.elements.slice(0, 3);
    const hiddenItems = group.elements.slice(3);

    const recTags = group.pdsRec.length > 0
      ? group.pdsRec.map((r) => `<code class="rec-tag">${r}</code>`).join(' ')
      : '';

    let elementCards = visibleItems.map((info) => createCustomElementCard(info, recTags)).join('');
    if (hiddenItems.length > 0) {
      elementCards += `
        <button class="expand-btn" data-count="${group.elements.length}">▼ Alle ${group.elements.length} anzeigen</button>
        <div class="expandable-content">
          ${hiddenItems.map((info) => createCustomElementCard(info, recTags)).join('')}
        </div>
      `;
    }

    html += `
      <div class="component-item custom-group">
        <div class="custom-group-header">
          <div class="custom-group-title">
            <span class="custom-type-name">${name}</span>
            ${sourceLabel ? `<span class="custom-source-badge">${sourceLabel}</span>` : ''}
            <span class="component-count warning-count">${group.elements.length}</span>
          </div>
        </div>
        ${elementCards}
      </div>
    `;
  }

  return `<div class="component-section"><div class="section-header warning"><span class="section-icon">⚠</span>Custom Elemente <span class="section-counts">${groups.size} Typen · ${[...groups.values()].reduce((s, g) => s + g.elements.length, 0)}× gefunden</span></div>${html}</div>`;
}

function createCustomElementCard(domInfo: DomInfo, recTags: string) {
  if (!domInfo.xpath) {
    return `<div class="dom-info minimal"><span class="el-tag-badge">&lt;${domInfo.tag}&gt;</span></div>`;
  }

  const textPreview = domInfo.text ? domInfo.text + (domInfo.text.length >= 30 ? '…' : '') : '';
  const xpathCommand = `$x('${domInfo.xpath}')[0]`;

  // Build attribute string for key attrs
  const attrParts = Object.entries(domInfo.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  const rows: string[] = [];

  // Row 1: tag → PDS recommendation
  const tagStr = `&lt;${domInfo.tag}${attrParts ? ' ' + attrParts : ''}&gt;`;
  rows.push(`<div class="el-row-main"><span class="el-tag-badge">${tagStr}</span>${recTags ? `<span class="el-arrow">→</span>${recTags}` : ''}</div>`);

  // Row 2: child content / label
  if (textPreview) {
    rows.push(`<div class="el-detail"><span class="el-detail-label">Label</span><span class="el-detail-value">"${textPreview}"</span></div>`);
  }

  // Row 3: ID
  if (domInfo.id) {
    rows.push(`<div class="el-detail"><span class="el-detail-label">ID</span><span class="el-detail-value el-id">#${domInfo.id}</span></div>`);
  }

  // Row 4: class (full)
  if (domInfo.classes && typeof domInfo.classes === 'string' && domInfo.classes.trim()) {
    rows.push(`<div class="el-detail"><span class="el-detail-label">Class</span><span class="el-detail-value el-classes">${domInfo.classes.trim()}</span></div>`);
  }

  // Row 5: XPath (full, copyable)
  rows.push(`<div class="el-detail"><span class="el-detail-label">XPath</span><code class="selector-code" data-copy-text="${xpathCommand}" title="Klicken zum Kopieren">${xpathCommand}</code><button class="highlight-btn" data-selector="${domInfo.xpath}" data-type="xpath" title="Auf Seite markieren">🔍</button></div>`);

  return `<div class="dom-info">${rows.join('')}</div>`;
}

function calcStats(results: AnalysisResults) {
  const dsInstances = Object.values(results.designSystem).reduce((sum, c) => sum + c, 0);
  const dsComponents = Object.keys(results.designSystem).length;
  const htmlInstances = Object.values(results.standardHtml).reduce(
    (sum, items) => sum + (Array.isArray(items) ? items.length : (items as unknown as number)),
    0,
  );
  const htmlComponents = Object.keys(results.standardHtml).length;
  const patternCount = results.ariaPatterns.length;
  const thirdPartyInstances = Object.values(results.thirdParty).reduce((sum, c) => sum + c, 0);
  const thirdPartyComponents = Object.keys(results.thirdParty).length;
  const nonDsInstances = htmlInstances + patternCount + thirdPartyInstances;
  const totalInstances = dsInstances + nonDsInstances;
  const compliance = totalInstances > 0 ? Math.round((dsInstances / totalInstances) * 100) : 0;
  return { dsInstances, dsComponents, htmlInstances, htmlComponents, patternCount, thirdPartyInstances, thirdPartyComponents, nonDsInstances, totalInstances, compliance };
}

function renderStats(container: HTMLElement, results: AnalysisResults) {
  const { dsInstances, dsComponents, nonDsInstances, totalInstances, compliance, patternCount, thirdPartyInstances, thirdPartyComponents } = calcStats(results);
  const versions = results.pdsVersions;
  let versionHtml: string;
  if (versions.length > 0) {
    const rows = versions.map((v) => {
      const defaultTag = '<code class="prefix-tag default">p-*</code>';
      const customTags = v.prefixes
        .map((p) => `<code class="prefix-tag">${p}-p-*</code>`)
        .join(' ');
      // Show default p-* if no custom prefixes, or always show it alongside custom ones
      const prefixList = v.prefixes.length > 0
        ? (defaultTag + ' ' + customTags).trim()
        : defaultTag;
      return `<tr><td class="ver-cell">${v.version}</td><td class="prefix-cell">${prefixList}</td></tr>`;
    }).join('');
    const cdnNote = results.cdnUrl ? `<div class="cdn-note">CDN: ${results.cdnUrl}</div>` : '';
    versionHtml = `
      <div class="version-table-wrap">
        <table class="version-table">
          <thead><tr><th>PDS Version</th><th>Prefixes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${cdnNote}
      </div>`;
  } else {
    versionHtml = '<div class="version-badge not-found">PDS nicht erkannt</div>';
  }

  container.innerHTML = `
    ${versionHtml}
    <div class="stat">
      <div class="stat-value neutral">${totalInstances}</div>
      <div>UI Elemente</div>
    </div>
    <div class="stat">
      <div class="stat-value ${compliance >= 70 ? 'success' : compliance >= 40 ? 'warning' : 'error'}">${compliance}%</div>
      <div>Compliance</div>
    </div>
    <div class="stat clickable" data-filter="pds">
      <div class="stat-value success">${dsInstances}</div>
      <div>PDS</div>
    </div>
    <div class="stat clickable" data-filter="custom">
      <div class="stat-value warning">${nonDsInstances}</div>
      <div>Custom</div>
    </div>
    <div class="stat full-width compliance-formula">
      <div>${dsInstances} PDS ÷ ${totalInstances} Gesamt = ${compliance}% Compliance</div>
    </div>
  `;
}

function displayQuickStats(results: AnalysisResults) {
  renderStats(quickStats, results);
  quickStats.style.display = 'grid';
}

function displayDetailedStats(results: AnalysisResults) {
  renderStats(detailsStats, results);
}

function displayDetailedComponents(data: AnalysisResults) {
  let html = '';

  if (Object.keys(data.designSystem).length > 0) {
    html += createComponentSection('Design System Komponenten', data.designSystem, 'success');
  }

  if (data.ariaPatterns.length > 0) {
    html += createPatternSection('ARIA-Pattern Erkennungen', data.ariaPatterns);
  }

  if (Object.keys(data.standardHtml).length > 0) {
    html += createComponentSection('Standard HTML Elemente', data.standardHtml, 'warning', true);
  }

  if (Object.keys(data.thirdParty).length > 0) {
    html += createComponentSection('Third-Party Komponenten', data.thirdParty, 'error');
  }

  detailsContent.innerHTML = html;
  attachDetailClickHandlers();
}

function attachDetailClickHandlers() {
  detailsContent.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.classList.contains('highlight-btn')) {
      const selector = target.getAttribute('data-selector');
      if (selector) highlightElement(selector);
    } else if (target.classList.contains('selector-code')) {
      const text = target.getAttribute('data-copy-text') || target.textContent || '';
      copyToClipboard(text);
    } else if (target.classList.contains('expand-btn')) {
      const componentItem = target.closest('.component-item');
      const expandableContent = componentItem?.querySelector('.expandable-content');
      if (!expandableContent) return;
      const isExpanded = expandableContent.classList.contains('expanded');

      if (isExpanded) {
        expandableContent.classList.remove('expanded');
        target.textContent = `▼ Alle ${target.getAttribute('data-count')} anzeigen`;
      } else {
        expandableContent.classList.add('expanded');
        target.textContent = '▲ Weniger anzeigen';
      }
    }
  });
}

function createComponentSection(
  title: string,
  components: Record<string, number | DomInfo[]>,
  type: 'success' | 'warning' | 'error',
  showDomInfo = false,
) {
  const typeIcons = { success: '✓', warning: '⚠', error: '✗' };
  let componentItems = '';
  const totalInstances = Object.values(components).reduce<number>((sum, d) => sum + (Array.isArray(d) ? d.length : (d as number)), 0);

  Object.entries(components).forEach(([component, data]) => {
    const count = Array.isArray(data) ? data.length : data;
    let domDetails = '';

    if (showDomInfo && Array.isArray(data)) {
      const visibleItems = data.slice(0, 3);
      const hiddenItems = data.slice(3);

      domDetails = visibleItems.map((info) => createDomInfoCard(info)).join('');

      if (hiddenItems.length > 0) {
        domDetails += `
          <button class="expand-btn" data-count="${data.length}">▼ Alle ${data.length} anzeigen</button>
          <div class="expandable-content">
            ${hiddenItems.map((info) => createDomInfoCard(info)).join('')}
          </div>
        `;
      }
    }

    componentItems += `
      <div class="component-item">
        <div class="component-header">
          <span class="component-name">&lt;${component}&gt;</span>
          <span class="component-count">${count}</span>
        </div>
        ${domDetails}
      </div>
    `;
  });

  return `
    <div class="component-section">
      <div class="section-header ${type}">
        <span class="section-icon">${typeIcons[type]}</span>
        ${title} <span class="section-counts">${Object.keys(components).length} Komponenten · ${totalInstances}× verwendet</span>
      </div>
      ${componentItems}
    </div>
  `;
}

function createPatternSection(title: string, patterns: PatternMatch[]) {
  const grouped = new Map<string, PatternMatch[]>();
  for (const p of patterns) {
    const key = `${p.pattern} → ${p.pdsAlternative}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const confidenceColors = { high: 'error', medium: 'warning', low: 'neutral' };
  const confidenceLabels = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };

  let items = '';
  for (const [key, matches] of grouped) {
    const first = matches[0];
    const visibleItems = matches.slice(0, 2);
    const hiddenItems = matches.slice(2);

    let domDetails = visibleItems.map((m) => createDomInfoCard(m.element)).join('');
    if (hiddenItems.length > 0) {
      domDetails += `
        <button class="expand-btn" data-count="${matches.length}">▼ Alle ${matches.length} anzeigen</button>
        <div class="expandable-content">
          ${hiddenItems.map((m) => createDomInfoCard(m.element)).join('')}
        </div>
      `;
    }

    items += `
      <div class="component-item">
        <div class="component-header">
          <span class="component-name pattern-name">${key}</span>
          <span class="component-count">${matches.length}</span>
        </div>
        <div class="confidence-badge ${confidenceColors[first.confidence]}">Confidence: ${confidenceLabels[first.confidence]}</div>
        ${domDetails}
      </div>
    `;
  }

  return `
    <div class="component-section">
      <div class="section-header info">
        <span class="section-icon">🔍</span>
        ${title} (${patterns.length})
      </div>
      ${items}
    </div>
  `;
}

function createDomInfoCard(domInfo: DomInfo) {
  const classInfo = domInfo.classes ? `class="${domInfo.classes}"` : '';
  const idInfo = domInfo.id ? `id="${domInfo.id}"` : '';
  const textPreview = domInfo.text ? `"${domInfo.text}${domInfo.text.length >= 30 ? '...' : ''}"` : '';

  let attributes = '';
  Object.entries(domInfo.attributes).forEach(([key, value]) => {
    attributes += `${key}="${value}" `;
  });

  const xpathCommand = `$x('${domInfo.xpath}')[0]`;

  return `
    <div class="dom-info">
      <div class="element-tag">&lt;${domInfo.tag} ${classInfo} ${idInfo} ${attributes.trim()}&gt;</div>
      ${textPreview ? `<div class="element-text">${textPreview}</div>` : ''}
      <div class="selector-row">
        <span class="selector-label">XPath:</span>
        <code class="selector-code" data-copy-text="${xpathCommand}" title="Klicken zum Kopieren">${xpathCommand}</code>
        <button class="highlight-btn" data-selector="${domInfo.xpath}" data-type="xpath" title="Element markieren">🔍</button>
      </div>
    </div>
  `;
}

async function highlightElement(selector: string) {
  if (!currentTabId) return;

  try {
    await browser.scripting.executeScript({
      target: { tabId: currentTabId },
      func: highlightElementOnPage,
      args: [selector],
    });
  } catch (error) {
    console.error('Error highlighting element:', error);
  }
}

function highlightElementOnPage(selector: string) {
  const existingHighlights = document.querySelectorAll('.ds-analyzer-highlight');
  existingHighlights.forEach((el) => {
    el.classList.remove('ds-analyzer-highlight');
    (el as HTMLElement).style.removeProperty('outline');
    (el as HTMLElement).style.removeProperty('outline-offset');
    (el as HTMLElement).style.removeProperty('background-color');
  });

  let element: Element | null = null;

  if (selector.startsWith('//') || selector.startsWith('//*')) {
    const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    element = result.singleNodeValue as Element;
  } else {
    element = document.querySelector(selector);
  }

  if (element) {
    element.classList.add('ds-analyzer-highlight');
    (element as HTMLElement).style.setProperty('outline', '3px solid #FC4040', 'important');
    (element as HTMLElement).style.setProperty('outline-offset', '2px', 'important');
    (element as HTMLElement).style.setProperty('background-color', 'rgba(252, 64, 64, 0.1)', 'important');

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      element!.classList.remove('ds-analyzer-highlight');
      (element as HTMLElement).style.removeProperty('outline');
      (element as HTMLElement).style.removeProperty('outline-offset');
      (element as HTMLElement).style.removeProperty('background-color');
    }, 5000);
  } else {
    alert('Element konnte nicht gefunden werden.');
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showStatus('In Zwischenablage kopiert!', 'success');
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    })
    .catch(() => {
      showStatus('Kopieren fehlgeschlagen', 'error');
    });
}

// ---- Injected into the target page via scripting.executeScript ----

function analyzeCurrentPage() {
  // ========== PDS Version Detection (Multi-Version + Multi-Prefix) ==========
  function detectPdsVersions(): { versions: PdsVersionInfo[]; cdnUrl: string | null; allCustomPrefixes: string[] } {
    const versions: PdsVersionInfo[] = [];
    let cdnUrl: string | null = null;
    const allCustomPrefixes: string[] = []; // only custom prefixes like 'icc', 'phn' etc.

    try {
      const pds = (document as any).porscheDesignSystem;
      if (pds) {
        // Read CDN info
        try { if (pds.cdn?.url) cdnUrl = String(pds.cdn.url); } catch { /* */ }

        // Strategy 1: Try JSON serialization to get past Proxy
        let keys: string[] = [];
        try {
          const serialized = JSON.parse(JSON.stringify(pds));
          keys = Object.keys(serialized).filter((k) => /^\d+\./.test(k));
          // Also get CDN from serialized
          if (!cdnUrl && serialized.cdn?.url) cdnUrl = String(serialized.cdn.url);
        } catch { /* Proxy may not be serializable */ }

        // Strategy 2: Try Object.keys directly
        if (keys.length === 0) {
          try { keys = Object.keys(pds).filter((k) => /^\d+\./.test(k)); } catch { /* */ }
        }

        // Strategy 3: Try for...in
        if (keys.length === 0) {
          try { for (const key in pds) { if (/^\d+\./.test(key)) keys.push(key); } } catch { /* */ }
        }

        // Strategy 4: Brute-force check common PDS version ranges
        if (keys.length === 0) {
          for (let major = 2; major <= 5; major++) {
            for (let minor = 0; minor <= 50; minor++) {
              for (let patch = 0; patch <= 20; patch++) {
                const ver = `${major}.${minor}.${patch}`;
                try {
                  if (pds[ver] && typeof pds[ver] === 'object') {
                    keys.push(ver);
                  }
                } catch { /* */ }
              }
            }
          }
        }

        for (const ver of keys) {
          try {
            const entry = pds[ver];
            if (!entry) continue;
            const prefixes: string[] = [];
            if (Array.isArray(entry.prefixes)) {
              for (const p of entry.prefixes) {
                const ps = String(p);
                prefixes.push(ps);
                if (!allCustomPrefixes.includes(ps)) allCustomPrefixes.push(ps);
              }
            }
            versions.push({ version: ver, prefixes });
          } catch { /* skip */ }
        }

        // Also check CDN prefixes
        try {
          if (pds.cdn?.prefixes && Array.isArray(pds.cdn.prefixes)) {
            for (const p of pds.cdn.prefixes) {
              const ps = String(p);
              if (!allCustomPrefixes.includes(ps)) allCustomPrefixes.push(ps);
            }
          }
        } catch { /* */ }

        if (versions.length > 0) return { versions, cdnUrl, allCustomPrefixes };

        // Fallback: old-style single version
        try {
          const singleVer = pds.version?.sdk || pds.version;
          if (singleVer) {
            const prefix = pds.prefix ? String(pds.prefix) : '';
            const prefixes = prefix && prefix !== 'p' ? [prefix] : [];
            versions.push({ version: String(singleVer), prefixes });
            if (prefix && prefix !== 'p' && !allCustomPrefixes.includes(prefix)) allCustomPrefixes.push(prefix);
            return { versions, cdnUrl, allCustomPrefixes };
          }
        } catch { /* */ }
      }
    } catch { /* ignore */ }

    // Fallback: detect from DOM
    if (versions.length === 0) {
      let hasDefaultPds = false;
      const domCustomPrefixes = new Set<string>();
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const tag = el.tagName.toLowerCase();
        if (tag.startsWith('p-') && pdsComponentNames.has(tag.slice(2))) {
          hasDefaultPds = true;
          continue;
        }
        const match = tag.match(/^(.+)-p-(.+)/);
        if (match && pdsComponentNames.has(match[2])) {
          domCustomPrefixes.add(match[1]);
        }
      }
      if (hasDefaultPds || domCustomPrefixes.size > 0) {
        // Combine: empty array = uses default p-*, custom prefixes listed explicitly
        const prefArr = [...domCustomPrefixes];
        versions.push({ version: 'unbekannt', prefixes: prefArr });
        for (const p of prefArr) { if (!allCustomPrefixes.includes(p)) allCustomPrefixes.push(p); }
      }
    }

    return { versions, cdnUrl, allCustomPrefixes };
  }

  // ========== Element Mapping (v3 + v4) ==========
  const elementMapping: Record<string, string[]> = {
    // v3 wrapper names + v4 direct component names
    'button': ['p-button', 'p-button-pure', 'p-button-tile'],
    'input[type="text"]': ['p-text-field-wrapper (v3)', 'p-input-text (v4)'],
    'input[type="email"]': ['p-text-field-wrapper (v3)', 'p-input-email (v4)'],
    'input[type="password"]': ['p-text-field-wrapper (v3)', 'p-input-password (v4)'],
    'input[type="number"]': ['p-text-field-wrapper (v3)', 'p-input-number (v4)'],
    'input[type="tel"]': ['p-text-field-wrapper (v3)', 'p-input-tel (v4)'],
    'input[type="url"]': ['p-text-field-wrapper (v3)', 'p-input-url (v4)'],
    'input[type="search"]': ['p-text-field-wrapper (v3)', 'p-input-search (v4)'],
    'input[type="date"]': ['p-text-field-wrapper (v3)', 'p-input-date (v4)'],
    'input[type="time"]': ['p-text-field-wrapper (v3)', 'p-input-time (v4)'],
    'input[type="checkbox"]': ['p-checkbox-wrapper (v3)', 'p-checkbox (v4)'],
    'input[type="radio"]': ['p-radio-button-wrapper (v3)', 'p-radio-group (v4)'],
    'select': ['p-select-wrapper (v3)', 'p-select (v4)', 'p-multi-select'],
    'textarea': ['p-textarea-wrapper (v3)', 'p-textarea (v4)'],
    'a[role="button"]': ['p-button', 'p-button-pure'],
    'table': ['p-table'],
  };

  // ========== Third-Party Prefixes ==========
  const thirdPartyPrefixes = [
    'mat-', 'mdc-', 'md-',           // Material / Angular Material
    'sl-',                             // Shoelace
    'ion-',                            // Ionic
    'v-', 'el-',                       // Vuetify / Element UI
    'chakra-',                         // Chakra UI
    'mantine-',                        // Mantine
    'ant-',                            // Ant Design
    'bp-', 'bp5-',                     // Blueprint
    'vaadin-',                         // Vaadin
    'fast-',                           // FAST (Microsoft)
    'calcite-',                        // Esri Calcite
    'carbon-',                         // IBM Carbon
    'cds-',                            // Clarity Design
  ];

  // ========== Skip Tags ==========
  const skipTags = new Set([
    'script', 'style', 'meta', 'title', 'head', 'html', 'body', 'noscript',
    'link', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div',
    'section', 'article', 'header', 'footer', 'nav', 'main', 'aside',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'img', 'picture', 'source',
    'svg', 'path', 'g', 'circle', 'rect', 'line', 'polygon', 'polyline',
    'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'del',
    'ins', 'sub', 'sup', 'code', 'pre', 'kbd', 'samp', 'var',
    'label', 'legend', 'fieldset', 'form', 'optgroup', 'option',
    'datalist', 'output', 'progress', 'meter', 'details', 'summary',
    'template', 'slot', 'iframe', 'embed', 'object', 'param',
    'video', 'audio', 'track', 'map', 'area', 'canvas',
    'figcaption', 'figure', 'time', 'abbr', 'address', 'cite',
    'bdi', 'bdo', 'data', 'dfn', 'q', 'rp', 'rt', 'ruby', 's', 'wbr',
  ]);

  // Known PDS component base names (without p- prefix)
  const pdsComponentNames = new Set([
    // Layout
    'grid', 'grid-item', 'flex', 'flex-item',
    // Typography
    'heading', 'text', 'display', 'text-list', 'text-list-item',
    // Navigation
    'link', 'link-pure', 'link-tile', 'link-tile-model-signature', 'link-social',
    // Buttons
    'button', 'button-pure', 'button-group', 'button-tile',
    // Form v3 wrappers
    'text-field-wrapper', 'textarea-wrapper', 'select-wrapper', 'checkbox-wrapper', 'radio-button-wrapper', 'pin-code',
    // Form v4 direct
    'input-text', 'input-email', 'input-password', 'input-number', 'input-tel', 'input-url', 'input-search', 'input-date', 'input-time',
    'checkbox', 'radio-group', 'radio-button', 'select', 'multi-select', 'textarea',
    // Feedback
    'inline-notification', 'banner', 'toast', 'modal', 'flyout', 'flyout-multilevel',
    // Data Display
    'table', 'table-head', 'table-head-row', 'table-head-cell', 'table-body', 'table-row', 'table-cell',
    'tag', 'tag-dismissible',
    // Navigation
    'tabs', 'tabs-bar', 'tabs-item', 'accordion', 'stepper-horizontal', 'stepper-horizontal-item',
    'pagination', 'segmented-control', 'segmented-control-item',
    // Media
    'carousel', 'icon', 'crest', 'marque', 'model-signature', 'wordmark',
    // Overlay
    'popover', 'scroller', 'scroll-area',
    // Utility
    'switch', 'spinner', 'divider', 'fieldset', 'fieldset-wrapper',
    'content-wrapper', 'toast-basic',
  ]);

  // Build all PDS tag prefixes from detected versions
  const pdsDetection = detectPdsVersions();
  const pdsPrefixes = new Set<string>();
  pdsPrefixes.add('p-'); // always include default p-* prefix
  for (const p of pdsDetection.allCustomPrefixes) {
    pdsPrefixes.add(p + '-p-'); // e.g. 'icc' → 'icc-p-'
  }
  // Also scan DOM for any prefixes not in the API
  const allDomElements = document.querySelectorAll('*');
  for (const el of allDomElements) {
    const tag = el.tagName.toLowerCase();
    const match = tag.match(/^(.+-p)-/);
    if (match) {
      const candidatePrefix = match[1] + '-';
      const remainder = tag.slice(candidatePrefix.length);
      if (remainder && pdsComponentNames.has(remainder)) {
        pdsPrefixes.add(candidatePrefix);
      }
    }
  }

  // ========== Helpers ==========
  function isPdsTag(tagName: string): boolean {
    for (const prefix of pdsPrefixes) {
      if (tagName.startsWith(prefix)) return true;
    }
    return false;
  }

  function getPdsDisplayName(tagName: string): string {
    // For custom prefixes, show both: "icc-p-link-pure (p-link-pure)"
    if (tagName.startsWith('p-')) return tagName;
    for (const prefix of pdsPrefixes) {
      if (prefix !== 'p-' && tagName.startsWith(prefix)) {
        const baseName = 'p-' + tagName.slice(prefix.length);
        return `${tagName} → ${baseName}`;
      }
    }
    return tagName;
  }

  function isInsidePdsComponent(element: Element): boolean {
    let parent: Element | null = element;
    while (parent) {
      const tag = parent.tagName.toLowerCase();
      if (isPdsTag(tag)) return true;
      // Check shadow DOM host
      const root = parent.getRootNode();
      if (root instanceof ShadowRoot) {
        parent = root.host;
        continue;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function isDesignSystemComponent(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    if (isPdsTag(tagName)) return true;
    // Check v3 wrapper pattern
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      const parentTag = parent.tagName.toLowerCase();
      if (isPdsTag(parentTag)) return true;
      parent = parent.parentElement;
      depth++;
    }
    return false;
  }

  function isThirdPartyComponent(tagName: string): string | null {
    // Don't flag PDS custom-prefix components as third-party
    if (isPdsTag(tagName)) return null;
    for (const prefix of thirdPartyPrefixes) {
      if (tagName.startsWith(prefix)) return prefix.replace(/-$/, '');
    }
    return null;
  }

  function isButtonLikeLink(element: Element): boolean {
    if (element.tagName.toLowerCase() !== 'a') return false;
    // Only flag links that are clearly used as buttons, not regular links/anchors
    if (element.getAttribute('role') === 'button') return true;
    const href = element.getAttribute('href');
    if (!href || href === '') return true;
    if (href === 'javascript:;' || href === 'javascript:void(0)' || href === 'javascript:void(0);') return true;
    if (/^javascript:/i.test(href)) return true;
    // href="#" alone (no anchor target) with onclick = button behavior
    if (href === '#' && element.hasAttribute('onclick')) return true;
    return false;
  }

  function generateXPath(element: Element): string {
    try {
      if (element.id) return `//*[@id='${element.id.replace(/'/g, "\\'")}']`;
      for (const attr of ['data-testid', 'data-id', 'name', 'aria-label']) {
        const value = element.getAttribute(attr);
        if (value) {
          const xpath = `//${element.tagName.toLowerCase()}[@${attr}='${value.replace(/'/g, "\\'")}']`;
          const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return xpath;
        }
      }
      if (element.className && typeof element.className === 'string' && element.className.trim()) {
        const xpath = `//${element.tagName.toLowerCase()}[@class='${element.className.trim().replace(/'/g, "\\'")}']`;
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (result.snapshotLength === 1) return xpath;
      }
      const path: string[] = [];
      let cur: Element | null = element;
      while (cur && cur.nodeType === Node.ELEMENT_NODE && cur.tagName !== 'HTML') {
        let index = 1;
        let sib = cur.previousElementSibling;
        while (sib) { if (sib.tagName === cur.tagName) index++; sib = sib.previousElementSibling; }
        const tag = cur.tagName.toLowerCase();
        let segment = tag;
        if (cur.id) { path.unshift(`${tag}[@id='${cur.id.replace(/'/g, "\\'")}']`); break; }
        else if (cur.className && typeof cur.className === 'string' && cur.className.trim()) {
          segment = `${tag}[@class[contains(.,'${cur.className.trim().split(/\s+/)[0].replace(/'/g, "\\'")}')]]`;
        }
        const siblings = cur.parentElement ? Array.from(cur.parentElement.children).filter((el) => el.tagName === cur!.tagName) : [];
        if (siblings.length > 1) segment += `[${index}]`;
        path.unshift(segment);
        cur = cur.parentElement;
        if (path.length >= 4) break;
      }
      return '//' + path.join('/');
    } catch { return `//${element.tagName.toLowerCase()}`; }
  }

  function getRelevantAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of ['type', 'href', 'src', 'role', 'data-testid', 'data-id', 'name', 'placeholder', 'alt', 'aria-expanded', 'aria-controls', 'aria-checked']) {
      const value = element.getAttribute(attr);
      if (value) attrs[attr] = value;
    }
    return attrs;
  }

  function getDomInfo(element: Element) {
    return {
      tag: element.tagName.toLowerCase(),
      classes: (element.className as string) || '',
      id: element.id || '',
      text: element.textContent?.trim().substring(0, 30) || '',
      attributes: getRelevantAttributes(element),
      xpath: generateXPath(element),
    };
  }

  // ========== ARIA Pattern Detection ==========
  function detectAriaPatterns(): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const seen = new WeakSet<Element>();

    // --- Tabs: role="tablist" + role="tab" + role="tabpanel" ---
    document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      if (isInsidePdsComponent(tablist)) return;
      if (seen.has(tablist)) return;
      seen.add(tablist);
      patterns.push({
        pattern: 'Tabs (role="tablist")',
        pdsAlternative: 'p-tabs',
        confidence: 'high',
        element: getDomInfo(tablist),
      });
    });

    // --- Modal: role="dialog" or <dialog> not inside p-modal ---
    document.querySelectorAll('[role="dialog"], dialog').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      const isModal = el.getAttribute('aria-modal') === 'true';
      patterns.push({
        pattern: isModal ? 'Modal (aria-modal)' : 'Dialog (role="dialog")',
        pdsAlternative: isModal ? 'p-modal' : 'p-modal / p-flyout',
        confidence: 'high',
        element: getDomInfo(el),
      });
    });

    // --- Switch: role="switch" ---
    document.querySelectorAll('[role="switch"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Toggle Switch (role="switch")',
        pdsAlternative: 'p-switch',
        confidence: 'high',
        element: getDomInfo(el),
      });
    });

    // --- Custom Dropdown: role="combobox" or role="listbox" ---
    document.querySelectorAll('[role="combobox"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Custom Dropdown (role="combobox")',
        pdsAlternative: 'p-select',
        confidence: 'high',
        element: getDomInfo(el),
      });
    });

    // --- Alert: role="alert" not in p-inline-notification ---
    document.querySelectorAll('[role="alert"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Alert (role="alert")',
        pdsAlternative: 'p-inline-notification / p-banner',
        confidence: 'high',
        element: getDomInfo(el),
      });
    });

    // --- Accordion: aria-expanded toggle pattern ---
    document.querySelectorAll('button[aria-expanded], [role="button"][aria-expanded]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      // Skip tabs — they also have aria-expanded
      if (el.getAttribute('role') === 'tab') return;
      if (el.closest('[role="tablist"]')) return;
      // Skip if inside a <details>
      if (el.closest('details')) return;
      // Check if it controls a panel (accordion-like)
      const controls = el.getAttribute('aria-controls');
      if (controls) {
        const panel = document.getElementById(controls);
        if (panel && (panel.getAttribute('role') === 'region' || panel.getAttribute('role') === 'group' || !panel.getAttribute('role'))) {
          seen.add(el);
          patterns.push({
            pattern: 'Accordion (aria-expanded + panel)',
            pdsAlternative: 'p-accordion',
            confidence: 'medium',
            element: getDomInfo(el),
          });
        }
      }
    });

    // --- Custom Radio Group: role="radiogroup" ---
    document.querySelectorAll('[role="radiogroup"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Radio Group (role="radiogroup")',
        pdsAlternative: 'p-radio-group',
        confidence: 'high',
        element: getDomInfo(el),
      });
    });

    // --- Pagination: nav with numbered page links ---
    document.querySelectorAll('nav').forEach((nav) => {
      if (isInsidePdsComponent(nav)) return;
      if (seen.has(nav)) return;
      const label = (nav.getAttribute('aria-label') || '').toLowerCase();
      const links = nav.querySelectorAll('a, button');
      // Count links whose visible text is just a number (page indicators)
      let numberCount = 0;
      links.forEach((l) => { if (/^\d+$/.test(l.textContent?.trim() || '')) numberCount++; });
      // Only match if there are actual numbered page links (≥3) AND label hints at pagination
      const labelHint = label.includes('paginat') || label.includes('seite') || label.includes('page');
      if (numberCount >= 3 && labelHint) {
        seen.add(nav);
        patterns.push({
          pattern: 'Pagination (nav + Seitenzahlen)',
          pdsAlternative: 'p-pagination',
          confidence: 'high',
          element: getDomInfo(nav),
        });
      }
    });

    // --- Tooltip: role="tooltip" ---
    document.querySelectorAll('[role="tooltip"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Tooltip (role="tooltip")',
        pdsAlternative: 'p-popover',
        confidence: 'medium',
        element: getDomInfo(el),
      });
    });

    // --- Stepper: role="progressbar" or step indicators ---
    document.querySelectorAll('[role="progressbar"]').forEach((el) => {
      if (isInsidePdsComponent(el)) return;
      if (seen.has(el)) return;
      seen.add(el);
      patterns.push({
        pattern: 'Progress / Stepper (role="progressbar")',
        pdsAlternative: 'p-stepper-horizontal',
        confidence: 'low',
        element: getDomInfo(el),
      });
    });

    return patterns;
  }

  // ========== Main Analysis ==========
  type DomInfoResult = ReturnType<typeof getDomInfo>;
  const results = {
    pdsVersions: pdsDetection.versions,
    cdnUrl: pdsDetection.cdnUrl,
    designSystem: {} as Record<string, number>,
    standardHtml: {} as Record<string, DomInfoResult[]>,
    ariaPatterns: [] as PatternMatch[],
    thirdParty: {} as Record<string, number>,
    error: undefined as string | undefined,
  };

  try {
    // 1. Scan all elements for tag-based detection
    document.querySelectorAll('*').forEach((element) => {
      try {
        const tagName = element.tagName.toLowerCase();
        if (skipTags.has(tagName)) return;

        // Check PDS component
        if (isDesignSystemComponent(element)) {
          const name = isPdsTag(tagName) ? getPdsDisplayName(tagName) : 'p-wrapper';
          results.designSystem[name] = (results.designSystem[name] || 0) + 1;
          return;
        }

        // Check third-party
        const thirdParty = isThirdPartyComponent(tagName);
        if (thirdParty) {
          results.thirdParty[tagName] = (results.thirdParty[tagName] || 0) + 1;
          return;
        }

        // Check standard HTML with PDS alternatives
        const type = (element as HTMLInputElement).type;

        if (tagName === 'a' && isButtonLikeLink(element)) {
          if (!results.standardHtml['a[role="button"]']) results.standardHtml['a[role="button"]'] = [];
          results.standardHtml['a[role="button"]'].push(getDomInfo(element));
          return;
        }
        if (tagName === 'a') return;

        let alternatives: string[] = [];
        if (tagName === 'input' && type) {
          alternatives = elementMapping[`input[type="${type}"]`] || [];
        } else {
          alternatives = elementMapping[tagName] || [];
        }

        if (alternatives.length > 0) {
          // Skip if inside a PDS component (shadow DOM child)
          if (isInsidePdsComponent(element)) return;

          const key = type ? `${tagName}[type="${type}"]` : tagName;
          if (!results.standardHtml[key]) results.standardHtml[key] = [];
          results.standardHtml[key].push(getDomInfo(element));
        }
      } catch { /* skip */ }
    });

    // 2. ARIA pattern detection
    results.ariaPatterns = detectAriaPatterns();

    return results;
  } catch (error) {
    return { ...results, error: (error as Error).message };
  }
}
