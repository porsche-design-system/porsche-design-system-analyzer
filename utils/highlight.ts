/**
 * Injected into the inspected page. Resolves a locator (one CSS selector per DOM root level,
 * piercing open shadow roots) and outlines the element for a few seconds.
 */
export function highlightOnPage(locator: string[]): { found: boolean; visible: boolean } {
  const CLASS = 'ds-analyzer-highlight';
  const reset = (el: HTMLElement) => {
    el.classList.remove(CLASS);
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    el.style.removeProperty('background-color');
  };
  (window as any).__pdsAnalyzerHighlighted?.forEach?.((el: HTMLElement) => reset(el));

  let root: Document | ShadowRoot | null = document;
  let el: Element | null = null;
  for (let i = 0; i < locator.length; i++) {
    try { el = root?.querySelector(locator[i]!) ?? null; } catch { el = null; }
    if (!el) return { found: false, visible: false };
    if (i < locator.length - 1) root = el.shadowRoot;
  }
  if (!el) return { found: false, visible: false };

  const h = el as HTMLElement;
  const visible = typeof (h as any).checkVisibility === 'function'
    ? (h as any).checkVisibility()
    : !!(h.offsetParent || h.offsetWidth || h.offsetHeight || getComputedStyle(h).position === 'fixed');
  if (!visible) return { found: true, visible: false };

  h.classList.add(CLASS);
  h.style.setProperty('outline', '3px solid #FC4040', 'important');
  h.style.setProperty('outline-offset', '2px', 'important');
  h.style.setProperty('background-color', 'rgba(252, 64, 64, 0.1)', 'important');
  (window as any).__pdsAnalyzerHighlighted = [h];
  h.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => reset(h), 5000);
  return { found: true, visible: true };
}
