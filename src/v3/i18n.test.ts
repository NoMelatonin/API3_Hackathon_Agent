import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalog,
  keys,
  countries,
  languages,
  translationStatus,
  formatToken,
  formatDate,
  historicalCurrency,
} from '../../web/v3/i18n.ts';
test('39 complete catalogs, draft labeling, 51 countries, RTL-compatible Intl and no invented FX', () => {
  assert.equal(languages.length, 39);
  assert.equal(countries.length, 51);
  for (const [lang] of languages) {
    assert.deepEqual(Object.keys(catalog[lang]!), [...keys]);
    assert.ok(Object.values(catalog[lang]!).every((s) => s.trim()));
    assert.ok(formatToken('4500000000', lang).includes('dUSD'));
    assert.ok(
      formatDate(1800000000, lang, 'Asia/Kolkata').includes('Asia/Kolkata'),
    );
    assert.equal(
      translationStatus(lang),
      ['de', 'en'].includes(lang) ? 'source-maintained' : 'unreviewed-draft',
    );
  }
  assert.equal(historicalCurrency(100, 'USD', 'en'), null);
  assert.equal(
    historicalCurrency(100, 'USD', 'en', {
      eurPerUnit: 0.8,
      asOf: '2026-10-30',
    })?.asOf,
    '2026-10-30',
  );
});
