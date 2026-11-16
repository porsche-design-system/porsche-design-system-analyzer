import { describe, expect, it } from 'vitest';
import { dictionaries, detectLang, setLang, t } from '../utils/i18n';
import type { CustomGroupId } from '../utils/types';

describe('i18n', () => {
  it('has the same keys and placeholders in all languages', () => {
    const { de, en } = dictionaries;
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const key of Object.keys(de) as (keyof typeof de)[]) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
      expect(ph(en[key]), key).toEqual(ph(de[key]));
      expect(en[key].trim(), key).not.toBe('');
    }
  });

  it('covers every custom group id', () => {
    const ids: CustomGroupId[] = ['button', 'buttonLink', 'checkbox', 'radio', 'select', 'selectMultiple', 'textarea', 'table',
      'fieldset', 'details', 'divider', 'input-text', 'input-email', 'input-password', 'input-number', 'input-tel', 'input-url',
      'input-search', 'input-date', 'input-time', 'input-month', 'input-week', 'tabs', 'modal', 'dialog', 'switch', 'combobox',
      'listbox', 'alert', 'accordion', 'radiogroup', 'pagination', 'tooltip', 'spinner', 'progress', 'carousel'];
    for (const id of ids) expect(dictionaries.en, id).toHaveProperty(`group.${id}`);
  });

  it('detects language from browser UI and interpolates params', () => {
    expect(detectLang('de-DE')).toBe('de');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('fr')).toBe('en');
    setLang('en');
    expect(t('status.done', { host: 'porsche.com' })).toBe('Analysis completed for: porsche.com');
    setLang('de');
    expect(t('status.done', { host: 'porsche.com' })).toBe('Analyse abgeschlossen für: porsche.com');
  });
});
