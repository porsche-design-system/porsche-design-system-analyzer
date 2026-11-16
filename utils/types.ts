export type PdsKind = 'component' | 'sub' | 'internal';

export interface PdsCatalogEntry {
  kind: PdsKind;
  experimental?: boolean;
  deprecated?: string;
  removedInV4?: boolean;
  replacedBy?: string;
  wrapping?: boolean;
  deprecatedProps?: { prop: string; attr: string; message: string; default: unknown }[];
  deprecatedValues?: { prop: string; attr: string; values: string[]; default: unknown }[];
}

export interface PdsCatalog {
  version: string;
  tags: Record<string, PdsCatalogEntry>;
}

export interface ElementInfo {
  tag: string;
  classes: string;
  id: string;
  text: string;
  attributes: Record<string, string>;
  /** CSS selector per DOM root level: [document, shadowRoot of host 1, …] */
  locator: string[];
  /** Expression that resolves the element in the DevTools console */
  consoleExpr: string;
  inShadowDom: boolean;
  visible: boolean;
}

export interface PdsVersionInfo {
  /** Detected version, or null if PDS tags were found but no version could be read */
  version: string | null;
  prefixes: string[];
}

export interface PdsUsage {
  /** Tag as found in the DOM, e.g. "icc-p-link-pure" */
  tag: string;
  /** Catalog tag without custom prefix, e.g. "p-link-pure" */
  base: string;
  kind: PdsKind;
  count: number;
  visibleCount: number;
  experimental?: boolean;
  deprecated?: boolean;
  removedInV4?: boolean;
  /** Registered custom element with PDS naming, but unknown to the bundled catalog */
  unknown?: boolean;
}

export type DeprecationType = 'component' | 'removed' | 'prop' | 'value';

export interface DeprecationFinding {
  type: DeprecationType;
  tag: string;
  base: string;
  prop?: string;
  value?: string;
  message?: string;
  replacedBy?: string;
  element: ElementInfo;
}

export type Confidence = 'high' | 'medium' | 'low';

/** Ids are resolved to labels in the panel via i18n (group.<id>) */
export type CustomGroupId =
  | 'button' | 'buttonLink' | 'checkbox' | 'radio' | 'select' | 'selectMultiple' | 'textarea' | 'table'
  | 'fieldset' | 'details' | 'divider'
  | 'input-text' | 'input-email' | 'input-password' | 'input-number' | 'input-tel' | 'input-url'
  | 'input-search' | 'input-date' | 'input-time' | 'input-month' | 'input-week'
  | 'tabs' | 'modal' | 'dialog' | 'switch' | 'combobox' | 'listbox' | 'alert' | 'accordion'
  | 'radiogroup' | 'pagination' | 'tooltip' | 'spinner' | 'progress' | 'carousel';

export interface CustomFinding {
  group: CustomGroupId;
  source: 'html' | 'aria';
  /** Name of the embedded third-party widget (chat, cookie banner, map …) the element belongs to */
  widget?: string;
  confidence: Confidence;
  recommendations: string[];
  element: ElementInfo;
}

export interface ThirdPartyUsage {
  library: string;
  tag: string;
  count: number;
  visibleCount: number;
}

export interface AnalysisResult {
  host: string;
  catalogVersion: string;
  pdsVersions: PdsVersionInfo[];
  cdnUrl: string | null;
  pdsUsage: PdsUsage[];
  deprecations: DeprecationFinding[];
  custom: CustomFinding[];
  thirdParty: ThirdPartyUsage[];
  scanned: { elements: number; shadowRoots: number };
  error?: string;
}
