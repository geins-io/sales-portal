import { describe, it, expect } from 'vitest';
import { getCountryOptions } from '../../app/utils/country-options';

describe('getCountryOptions', () => {
  it('returns Sverige for SE when locale is sv', () => {
    const options = getCountryOptions('sv');
    const se = options.find((o) => o.value === 'SE');
    expect(se).toBeDefined();
    expect(se!.label).toBe('Sverige');
  });

  it('returns more than 200 entries', () => {
    const options = getCountryOptions('sv');
    expect(options.length).toBeGreaterThan(200);
  });

  it('returns labels in English when locale is en', () => {
    const enOptions = getCountryOptions('en');
    const seLabel = enOptions.find((o) => o.value === 'SE')?.label;
    expect(seLabel).toBe('Sweden');
  });

  it('differs for sv vs en for at least one country', () => {
    const svOptions = getCountryOptions('sv');
    const enOptions = getCountryOptions('en');
    const svSe = svOptions.find((o) => o.value === 'SE')?.label;
    const enSe = enOptions.find((o) => o.value === 'SE')?.label;
    expect(svSe).not.toBe(enSe);
  });

  it('returns a list sorted by label', () => {
    const options = getCountryOptions('sv');
    for (let i = 1; i < options.length; i++) {
      expect(
        options[i - 1]!.label.localeCompare(options[i]!.label, 'sv'),
      ).toBeLessThanOrEqual(0);
    }
  });
});
