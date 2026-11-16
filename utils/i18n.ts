export type Lang = 'de' | 'en';
export const LANGS: Lang[] = ['de', 'en'];

const de = {
  'header.subtitle': 'DS-Compliance-Check für Web-Komponenten',
  'lang.label': 'Sprache',
  'analyze': 'Website analysieren',

  'status.close': 'Schließen',
  'status.noTab': 'Kein aktiver Tab gefunden.',
  'status.analyzing': 'Analysiere Website …',
  'status.done': 'Analyse abgeschlossen für: {host}',
  'status.failed': 'Fehler bei der Analyse',
  'status.error': 'Fehler: {message}',
  'status.copied': 'In Zwischenablage kopiert!',
  'status.copyFailed': 'Kopieren fehlgeschlagen',
  'status.notFound': 'Element nicht gefunden – die Seite hat sich eventuell geändert.',
  'status.hidden': 'Element ist versteckt (Overlay/Dialog) – öffne es auf der Seite und versuche es erneut.',
  'status.highlightFailed': 'Markieren fehlgeschlagen – Tab evtl. gewechselt.',

  'tab.pds': 'PDS',
  'tab.custom': 'Custom',
  'tab.deprecations': 'Deprecations',

  'stats.uiElements': 'UI-Elemente',
  'stats.compliance': 'Compliance',
  'stats.formula': '{pds} PDS-Komponenten / {total} UI-Elemente gesamt = {pct} Compliance',
  'stats.scanned': '{elements} Elemente geprüft · {shadow} Shadow Roots durchsucht · Katalog PDS {catalog}',
  'stats.ignored': 'Nicht gewertet: versteckt {hidden} · Third-Party-Widgets {widgets}',
  'opts.includeHidden': 'Versteckte Elemente mitzählen',
  'opts.includeWidgets': 'Third-Party-Widgets mitzählen (Chat, Cookie-Banner, Karten …)',
  'pds.visible': '{n} sichtbar',
  'custom.notScored': 'Nicht gewertet',
  'custom.widgetGroup': 'Widget: {name}',
  'custom.hiddenGroup': 'Versteckte Elemente',
  'version.version': 'PDS-Version',
  'version.prefixes': 'Prefixe',
  'version.notDetected': 'PDS nicht erkannt',
  'version.unknown': 'unbekannt',
  'version.outdated': 'aktuell: {latest}',
  'version.cdn': 'CDN: {url}',

  'pds.empty': 'Keine PDS-Komponenten gefunden',
  'pds.components': 'Komponenten',
  'pds.subcomponents': 'Unterkomponenten (nicht in Compliance gewertet)',
  'badge.experimental': 'experimentell',
  'badge.deprecated': 'deprecated',
  'badge.removedInV4': 'in v4 entfernt',
  'badge.unknown': 'nicht im Katalog',
  'badge.hidden': 'versteckt',
  'badge.shadow': 'Shadow DOM',
  'badge.aria': 'ARIA-Pattern',
  'badge.thirdParty': 'Third-Party',

  'custom.empty': 'Keine Custom-Elemente gefunden',
  'custom.label': 'Label',
  'custom.id': 'ID',
  'custom.class': 'Class',
  'custom.selector': 'Selektor',
  'custom.copy': 'Klicken zum Kopieren',
  'custom.highlight': 'Auf Seite markieren',
  'custom.accept': 'OK – Custom ist korrekt',
  'custom.reset': 'Zurücksetzen',
  'custom.acceptAll': 'Alle akzeptieren',
  'custom.resetAll': 'Alle zurücksetzen',
  'custom.confidence.high': 'Sicherheit: hoch',
  'custom.confidence.medium': 'Sicherheit: mittel',
  'custom.confidence.low': 'Sicherheit: niedrig',
  'thirdParty.primeng': 'p-* ohne PDS (vermutlich PrimeNG)',

  'dep.empty': 'Keine veralteten PDS-APIs gefunden',
  'dep.intro': 'Geprüft gegen PDS {catalog}. Deprecated APIs funktionieren noch, entfallen aber mit dem nächsten Major-Release.',
  'dep.removed': 'In v4 entfernt',
  'dep.component': 'Komponente deprecated',
  'dep.prop': 'Prop deprecated',
  'dep.value': 'Wert deprecated',
  'dep.replacedBy': 'Ersatz',
  'dep.noReplacement': 'kein direkter Ersatz',
  'dep.note': 'Hinweis',

  'group.button': 'Button',
  'group.buttonLink': 'Link als Button',
  'group.checkbox': 'Checkbox',
  'group.radio': 'Radio-Button',
  'group.select': 'Select / Dropdown',
  'group.selectMultiple': 'Mehrfachauswahl',
  'group.textarea': 'Textarea',
  'group.table': 'Tabelle',
  'group.fieldset': 'Fieldset',
  'group.details': 'Details / Summary',
  'group.divider': 'Trennlinie (hr)',
  'group.input-text': 'Text-Input',
  'group.input-email': 'E-Mail-Input',
  'group.input-password': 'Passwort-Input',
  'group.input-number': 'Zahlen-Input',
  'group.input-tel': 'Telefon-Input',
  'group.input-url': 'URL-Input',
  'group.input-search': 'Such-Input',
  'group.input-date': 'Datums-Input',
  'group.input-time': 'Zeit-Input',
  'group.input-month': 'Monats-Input',
  'group.input-week': 'Wochen-Input',
  'group.tabs': 'Tabs',
  'group.modal': 'Modal',
  'group.dialog': 'Dialog',
  'group.switch': 'Toggle-Switch',
  'group.combobox': 'Custom Dropdown (Combobox)',
  'group.listbox': 'Custom Listbox',
  'group.alert': 'Alert / Hinweis',
  'group.accordion': 'Accordion',
  'group.radiogroup': 'Radio-Gruppe',
  'group.pagination': 'Pagination',
  'group.tooltip': 'Tooltip',
  'group.spinner': 'Ladeindikator',
  'group.progress': 'Fortschritt / Stepper',
  'group.carousel': 'Karussell / Slider',
};

export type I18nKey = keyof typeof de;

const en: Record<I18nKey, string> = {
  'header.subtitle': 'DS compliance check for web components',
  'lang.label': 'Language',
  'analyze': 'Analyze website',

  'status.close': 'Close',
  'status.noTab': 'No active tab found.',
  'status.analyzing': 'Analyzing website …',
  'status.done': 'Analysis completed for: {host}',
  'status.failed': 'Analysis failed',
  'status.error': 'Error: {message}',
  'status.copied': 'Copied to clipboard!',
  'status.copyFailed': 'Copy failed',
  'status.notFound': 'Element not found – the page may have changed.',
  'status.hidden': 'Element is hidden (overlay/dialog) – open it on the page and try again.',
  'status.highlightFailed': 'Highlighting failed – the tab may have changed.',

  'tab.pds': 'PDS',
  'tab.custom': 'Custom',
  'tab.deprecations': 'Deprecations',

  'stats.uiElements': 'UI elements',
  'stats.compliance': 'Compliance',
  'stats.formula': '{pds} PDS components / {total} UI elements in total = {pct} compliance',
  'stats.scanned': '{elements} elements checked · {shadow} shadow roots scanned · catalog PDS {catalog}',
  'stats.ignored': 'Not counted: hidden {hidden} · third-party widgets {widgets}',
  'opts.includeHidden': 'Count hidden elements',
  'opts.includeWidgets': 'Count third-party widgets (chat, cookie banner, maps …)',
  'pds.visible': '{n} visible',
  'custom.notScored': 'Not counted',
  'custom.widgetGroup': 'Widget: {name}',
  'custom.hiddenGroup': 'Hidden elements',
  'version.version': 'PDS version',
  'version.prefixes': 'Prefixes',
  'version.notDetected': 'PDS not detected',
  'version.unknown': 'unknown',
  'version.outdated': 'latest: {latest}',
  'version.cdn': 'CDN: {url}',

  'pds.empty': 'No PDS components found',
  'pds.components': 'Components',
  'pds.subcomponents': 'Sub-components (not counted for compliance)',
  'badge.experimental': 'experimental',
  'badge.deprecated': 'deprecated',
  'badge.removedInV4': 'removed in v4',
  'badge.unknown': 'not in catalog',
  'badge.hidden': 'hidden',
  'badge.shadow': 'Shadow DOM',
  'badge.aria': 'ARIA pattern',
  'badge.thirdParty': 'Third-party',

  'custom.empty': 'No custom elements found',
  'custom.label': 'Label',
  'custom.id': 'ID',
  'custom.class': 'Class',
  'custom.selector': 'Selector',
  'custom.copy': 'Click to copy',
  'custom.highlight': 'Highlight on page',
  'custom.accept': 'OK – custom is intended',
  'custom.reset': 'Reset',
  'custom.acceptAll': 'Accept all',
  'custom.resetAll': 'Reset all',
  'custom.confidence.high': 'Confidence: high',
  'custom.confidence.medium': 'Confidence: medium',
  'custom.confidence.low': 'Confidence: low',
  'thirdParty.primeng': 'p-* without PDS (likely PrimeNG)',

  'dep.empty': 'No deprecated PDS APIs found',
  'dep.intro': 'Checked against PDS {catalog}. Deprecated APIs still work but will be removed with the next major release.',
  'dep.removed': 'Removed in v4',
  'dep.component': 'Component deprecated',
  'dep.prop': 'Prop deprecated',
  'dep.value': 'Value deprecated',
  'dep.replacedBy': 'Replacement',
  'dep.noReplacement': 'no direct replacement',
  'dep.note': 'Note',

  'group.button': 'Button',
  'group.buttonLink': 'Link used as button',
  'group.checkbox': 'Checkbox',
  'group.radio': 'Radio button',
  'group.select': 'Select / dropdown',
  'group.selectMultiple': 'Multi-select',
  'group.textarea': 'Textarea',
  'group.table': 'Table',
  'group.fieldset': 'Fieldset',
  'group.details': 'Details / summary',
  'group.divider': 'Divider (hr)',
  'group.input-text': 'Text input',
  'group.input-email': 'Email input',
  'group.input-password': 'Password input',
  'group.input-number': 'Number input',
  'group.input-tel': 'Phone input',
  'group.input-url': 'URL input',
  'group.input-search': 'Search input',
  'group.input-date': 'Date input',
  'group.input-time': 'Time input',
  'group.input-month': 'Month input',
  'group.input-week': 'Week input',
  'group.tabs': 'Tabs',
  'group.modal': 'Modal',
  'group.dialog': 'Dialog',
  'group.switch': 'Toggle switch',
  'group.combobox': 'Custom dropdown (combobox)',
  'group.listbox': 'Custom listbox',
  'group.alert': 'Alert / notification',
  'group.accordion': 'Accordion',
  'group.radiogroup': 'Radio group',
  'group.pagination': 'Pagination',
  'group.tooltip': 'Tooltip',
  'group.spinner': 'Loading indicator',
  'group.progress': 'Progress / stepper',
  'group.carousel': 'Carousel / slider',
};

export const dictionaries: Record<Lang, Record<I18nKey, string>> = { de, en };

const STORAGE_KEY = 'pds-analyzer-lang';
let current: Lang = 'en';
const listeners = new Set<(lang: Lang) => void>();

export function detectLang(uiLanguage: string | undefined): Lang {
  return uiLanguage?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function initLang(uiLanguage: string | undefined): Lang {
  let stored: string | null = null;
  try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  current = LANGS.includes(stored as Lang) ? (stored as Lang) : detectLang(uiLanguage);
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: (lang: Lang) => void) {
  listeners.add(fn);
}

export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  return params ? template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : template;
}
