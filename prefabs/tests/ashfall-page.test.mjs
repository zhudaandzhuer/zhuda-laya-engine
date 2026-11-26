// 「灰燼之庭」's page without a browser: the markup carries every node interface.ts and
// ashfall-duel.ts look up, the mark's address is the only part that changes, and the
// style sheets come in the order that lets court.css override the shared menu styles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COURT_MARK, COURT_STYLES, courtMarkup } from '../2d/ashfall-duel/court-page.ts';

test('the court markup has every node the controls look up, once', () => {
  const html = courtMarkup();
  const source = fs.readFileSync(new URL('../2d/ashfall-duel/interface.ts', import.meta.url), 'utf8') +
    fs.readFileSync(new URL('../2d/ashfall-duel/ashfall-duel.ts', import.meta.url), 'utf8');
  const ids = new Set([...source.matchAll(/(?:element|getElementById)\("([a-z-]+)"\)/g)].map((m) => m[1]));
  assert.ok(ids.size >= 15, [...ids].join(' '));
  for (const id of ids) assert.equal(html.split(`id="${id}"`).length - 1, 1, `#${id}`);
  for (const touch of ['left', 'right', 'evade', 'attack']) assert.ok(html.includes(`data-touch="${touch}"`), touch);
  assert.match(html, /^<main id="theatre" data-mode="loading">/);
  assert.ok(html.endsWith('</main>'));
  assert.ok(html.includes(`src="${COURT_MARK}"`));
  assert.ok(courtMarkup('x.svg').includes('src="x.svg"'));
  assert.ok(fs.existsSync(new URL('../2d/ashfall-duel/assets/branding/zhuda-layaair-mark.svg', import.meta.url)));
  assert.deepEqual(COURT_STYLES.map((s) => s.split('/').pop()), ['game-menu.css', 'settings-form.css', 'court.css']);
});
