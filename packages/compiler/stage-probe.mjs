// The Laya stage of a running page, read from outside it, and scenario steps that use it:
// a click on a control found by its name or by what it says, and an expectation checked
// against the stage. Nothing here is in a game's bundle: the probe is sent to the page as
// text by the tool that drives the browser (Chrome's debugging protocol, Playwright, the
// phone driver), so a release build is not one byte larger and a page built before the
// probe existed can be read all the same. It needs `window.Laya`, which every page of this
// engine has (the LayaAir libraries are classic scripts).
//
//   const report = await browser.evaluate(stageProbeExpression());
//   findStageNodes(report, { name: 'menu' })[0].rect      // [x, y, width, height] in CSS pixels
//
// Scenario steps (prefabs/viewer2d/tools/play.mjs, prefabs/tools/detplay.mjs):
//   { "click": { "name": "level-0" } }      { "click": "level-0" }      { "click": { "text": "選單" } }
//   { "click": { "text": "前進" }, "hold": 0.2 }                   the button stays down that long
//   { "expect": { "name": "menu" } }                              a shown node of that name
//   { "expect": { "name": "mute", "text": "聲音：關" } }           it, or a label inside it, says so
//   { "expect": { "textMatches": "^\\d+ / 1500 分$" } }           a shown label matches
//   { "expect": { "name": "again", "visible": false } }           there, and not shown
//   { "expect": { "text": "豐收！", "count": 0 } }                 no shown label says so
//   { "expect": { "js": "S.screen === 'play'" } }                 an expression on the page hook
//   { "expect": [ … ] }                                           every one of them
//   { "expect": { "text": "豐收！", "within": 30 } }               … within 30 seconds of the player's clock
//   { "probe": "title" }                                          the whole report, as <out>/title.stage.json

/**
 * Runs in the page. Walks `Laya.stage` and gives back every node: its name, its LayaAir
 * class, whether it is visible itself and shown (it and every node above it), whether its
 * `mouseEnabled` is set and which pointer events it listens for, what it says, and where it
 * is on the page in CSS pixels.
 *
 * It is sent as text (`stageProbeExpression`), so it uses nothing outside itself, and it
 * is written for an old runtime: no optional chaining, no `??`.
 *
 * `options.counts`: only the two counts (no tree, no rectangles).
 * `options.maxNodes`: stop adding to the tree at this many nodes (default 20000).
 */
export function zhudaStageProbe(options) {
  const o = options || {};
  const L = globalThis.Laya;
  const stage = L && L.stage;
  if (!stage) return { ok: false, reason: 'no Laya.stage on this page' };

  // The libraries are minified: a constructor's own name is a letter. The keys of the Laya
  // namespace are the real names, so a node's class is the nearest one found there.
  const names = new Map();
  for (const key of Object.keys(L)) {
    let value;
    try {
      value = L[key];
    } catch (e) {
      continue;
    }
    if (typeof value === 'function' && value.prototype && !names.has(value)) names.set(value, key);
  }
  const classOf = (node) => {
    for (let c = node.constructor; typeof c === 'function'; c = Object.getPrototypeOf(c)) {
      const known = names.get(c);
      if (known) return known;
    }
    return 'Node';
  };

  // Stage units to CSS pixels of the page. The canvas covers the stage in every scale mode,
  // so its client rectangle is the answer; a stage LayaAir itself has turned on the page
  // (screenMode on a screen of the other shape) is LayaAir's own pointer mapping, backwards.
  const doc = globalThis.document;
  const main = L.Browser && L.Browser.mainCanvas && L.Browser.mainCanvas.source;
  const canvas = main && main.getBoundingClientRect ? main : doc && doc.querySelector('canvas');
  const box =
    canvas && canvas.getBoundingClientRect
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: stage.width, height: stage.height };
  const kx = box.width / stage.width;
  const ky = box.height / stage.height;
  const m = stage._canvasTransform;
  const turned = !!m && (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6);
  const toPage = (x, y) => {
    if (!turned) return [box.left + x * kx, box.top + y * ky];
    const px = x * stage.clientScaleX;
    const py = y * stage.clientScaleY;
    return [
      m.a * px + m.c * py + m.tx - (globalThis.scrollX || 0),
      m.b * px + m.d * py + m.ty - (globalThis.scrollY || 0),
    ];
  };

  const round = (v) => Math.round(v * 100) / 100;
  const point = L.Point ? new L.Point() : null;
  const rectOf = (node) => {
    if (!point || typeof node.localToGlobal !== 'function') return null;
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;
    try {
      w = Number(node.width) || 0;
      h = Number(node.height) || 0;
      // No size of its own: what it draws (a sprite with only graphics).
      if (!(w > 0 && h > 0) && typeof node.getSelfBounds === 'function') {
        const b = node.getSelfBounds();
        if (b && b.width > 0 && b.height > 0) {
          x = b.x;
          y = b.y;
          w = b.width;
          h = b.height;
        }
      }
    } catch (e) {
      /* a node that cannot say its size has none */
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const corners = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ];
    for (let i = 0; i < 4; i++) {
      point.x = corners[i][0];
      point.y = corners[i][1];
      let g;
      try {
        g = node.localToGlobal(point, false);
      } catch (e) {
        return null;
      }
      const p = toPage(g.x, g.y);
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    return [round(x0), round(y0), round(x1 - x0), round(y1 - y0)];
  };
  const textOf = (node) => {
    const keys = ['text', 'label', 'title'];
    for (let i = 0; i < keys.length; i++) {
      let value;
      try {
        value = node[keys[i]];
      } catch (e) {
        continue;
      }
      if (typeof value === 'string') return value;
    }
    return undefined;
  };

  const pointerEvents = ['click', 'mousedown', 'mouseup'];
  const max = o.maxNodes > 0 ? o.maxNodes : 20000;
  let total = 0;
  let shownCount = 0;
  let truncated = false;
  const walk = (node, parentShown) => {
    total++;
    const visible = node.visible !== false && node.active !== false;
    const shown = parentShown && visible;
    if (shown) shownCount++;
    const kids = node._children || [];
    if (o.counts) {
      for (let i = 0; i < kids.length; i++)
        if (kids[i] && !kids[i]._destroyed) walk(kids[i], shown);
      return null;
    }
    const out = {
      name: typeof node.name === 'string' ? node.name : '',
      class: classOf(node),
      visible: visible,
      shown: shown,
      mouseEnabled: node.mouseEnabled === true,
    };
    // A node may take the pointer without `mouseEnabled` ever being set: listening is enough.
    if (typeof node.hasListener === 'function') {
      const heard = [];
      for (let i = 0; i < pointerEvents.length; i++)
        if (node.hasListener(pointerEvents[i])) heard.push(pointerEvents[i]);
      if (heard.length) out.listens = heard;
    }
    const text = textOf(node);
    if (text !== undefined) out.text = text;
    out.rect = rectOf(node);
    out.children = [];
    for (let i = 0; i < kids.length; i++) {
      if (!kids[i] || kids[i]._destroyed) continue;
      if (total >= max) {
        truncated = true;
        break;
      }
      out.children.push(walk(kids[i], shown));
    }
    return out;
  };
  const root = walk(stage, true);
  const report = {
    ok: true,
    stage: [stage.width, stage.height],
    canvas: [round(box.left), round(box.top), round(box.width), round(box.height)],
    view: [globalThis.innerWidth || 0, globalThis.innerHeight || 0],
    turned: turned,
    total: total,
    shown: shownCount,
  };
  if (!o.counts) {
    report.truncated = truncated;
    report.root = root;
  }
  return report;
}

/**
 * Runs in the page. The page element that would take a click at a point instead of the
 * stage's canvas (a splash still fading, an HTML panel over the game), as `tag#id.class`;
 * null when the canvas is on top there. Sent as text, like the probe.
 */
export function zhudaStageCover(x, y) {
  const L = globalThis.Laya;
  const doc = globalThis.document;
  if (!doc || typeof doc.elementFromPoint !== 'function') return null;
  const main = L && L.Browser && L.Browser.mainCanvas && L.Browser.mainCanvas.source;
  const canvas = main && main.getBoundingClientRect ? main : doc.querySelector('canvas');
  const top = doc.elementFromPoint(x, y);
  if (!top || top === canvas) return null;
  const classes = typeof top.className === 'string' ? top.className.trim() : '';
  return (
    String(top.tagName).toLowerCase() +
    (top.id ? '#' + top.id : '') +
    (classes ? '.' + classes.split(/\s+/).join('.') : '')
  );
}

/** The probe as an expression a browser driver evaluates in the page (returned by value). */
export function stageProbeExpression(options = {}) {
  return `(${zhudaStageProbe.toString()})(${JSON.stringify(options)})`;
}

/**
 * What `node` says and what the labels inside it say, as long as nothing between one and
 * `node` is hidden. LayaAir's Label holds a Text that says the same: that is said once.
 */
function textsWithin(node, out = [], above) {
  if (typeof node.text === 'string' && node.text !== above) out.push(node.text);
  for (const child of node.children ?? []) if (child.visible) textsWithin(child, out, node.text);
  return out;
}

/**
 * A probe report's tree as a list in drawing order. Each entry is the node without its
 * children, with `path` (names from the stage down; a node without a name is its class and
 * its place among its parent's children), `depth`, `texts` (what it says, then what the
 * labels inside it say), `echo` (it only repeats the label it sits in) and `node` (the entry
 * of the tree itself).
 */
export function listStageNodes(report) {
  if (!report?.root)
    throw Error('Not a stage report with a tree (was the probe asked for counts only?)');
  const list = [];
  const visit = (node, path, depth, above) => {
    const { children = [], ...own } = node;
    const entry = { ...own, path, depth, texts: textsWithin(node), node };
    // The Text inside a Label: the same words a second time, one level down.
    if (typeof node.text === 'string' && node.text === above) entry.echo = true;
    list.push(entry);
    children.forEach((child, i) =>
      visit(child, `${path}/${child.name || `${child.class}[${i}]`}`, depth + 1, node.text),
    );
  };
  visit(report.root, report.root.name || report.root.class, 0);
  return list;
}

const SELECTOR_KEYS = ['name', 'text', 'textMatches', 'class', 'nth'];
const EXPECT_KEYS = [...SELECTOR_KEYS, 'visible', 'count', 'js', 'within'];

/** A selector as written in a scenario (a string is a name), checked; throws on a slip of the pen. */
export function normalizeStageSelector(value, what = 'selector', known = SELECTOR_KEYS) {
  const selector = typeof value === 'string' ? { name: value } : value;
  if (!selector || typeof selector !== 'object' || Array.isArray(selector))
    throw Error(`${what} is a name or an object with any of ${known.join(', ')}`);
  for (const key of Object.keys(selector))
    if (!known.includes(key))
      throw Error(`${what} has an unknown key "${key}" (known: ${known.join(', ')})`);
  for (const key of ['name', 'text', 'textMatches', 'class'])
    if (selector[key] !== undefined && typeof selector[key] !== 'string')
      throw Error(`${what}: "${key}" is a string`);
  if (selector.textMatches !== undefined)
    try {
      new RegExp(selector.textMatches);
    } catch (error) {
      throw Error(`${what}: "textMatches" is not a regular expression (${error.message})`);
    }
  if (selector.nth !== undefined && !(Number.isInteger(selector.nth) && selector.nth >= 0))
    throw Error(`${what}: "nth" is a whole number, counted from 0`);
  return selector;
}

const selects = (selector) =>
  ['name', 'text', 'textMatches', 'class'].some((key) => selector[key] !== undefined);

function matches(entry, selector) {
  if (selector.name !== undefined && entry.name !== selector.name) return false;
  if (selector.class !== undefined && entry.class !== selector.class) return false;
  // With a name or a class the node is a control: what it says may be said by a label inside
  // it. With the text alone the node is the label itself, so one label is one match (and a
  // Label that holds a Text of the same words is the Label).
  const control = selector.name !== undefined || selector.class !== undefined;
  if (!control && entry.echo) return false;
  const texts = control ? entry.texts : entry.text === undefined ? [] : [entry.text];
  if (selector.text !== undefined && !texts.includes(selector.text)) return false;
  if (selector.textMatches !== undefined) {
    const pattern = new RegExp(selector.textMatches);
    if (!texts.some((text) => pattern.test(text))) return false;
  }
  return true;
}

/**
 * The nodes of a report that a selector picks, in drawing order. `shown: true` (the
 * default) keeps the ones on show, `false` the ones that are there and hidden, `null` both.
 */
export function findStageNodes(report, selector, { shown = true } = {}) {
  const wanted = normalizeStageSelector(selector, 'selector', EXPECT_KEYS);
  const found = listStageNodes(report).filter(
    (entry) => matches(entry, wanted) && (shown === null || entry.shown === shown),
  );
  return wanted.nth === undefined ? found : found.slice(wanted.nth, wanted.nth + 1);
}

const quote = (text) => JSON.stringify(text.length > 60 ? text.slice(0, 57) + '…' : text);
const describe = (entry) =>
  `${entry.path} (${entry.shown ? 'shown' : 'hidden'}${entry.texts.length ? `, says ${entry.texts.slice(0, 3).map(quote).join(' ')}` : ''})`;

/** What is on the stage that is nearest to what a selector asked for, in words. */
export function describeStageNear(report, selector) {
  const wanted = normalizeStageSelector(selector, 'selector', EXPECT_KEYS);
  const all = listStageNodes(report);
  const control = wanted.name !== undefined || wanted.class !== undefined;
  if (control) {
    const same = all.filter(
      (entry) =>
        (wanted.name === undefined || entry.name === wanted.name) &&
        (wanted.class === undefined || entry.class === wanted.class),
    );
    if (same.length)
      return `found ${same.length}: ${same.slice(0, 5).map(describe).join('; ')}${same.length > 5 ? '; …' : ''}`;
    const others = [
      ...new Set(
        all
          .filter((entry) => entry.shown)
          .map((entry) => (wanted.name !== undefined ? entry.name : entry.class))
          .filter(Boolean),
      ),
    ];
    return `found no node ${wanted.name !== undefined ? `named ${quote(wanted.name)}` : `of class ${wanted.class}`}; shown ${wanted.name !== undefined ? 'names' : 'classes'}: ${others.slice(0, 24).join(', ') || 'none'}${others.length > 24 ? ', …' : ''}`;
  }
  const said = all.filter((entry) => entry.text !== undefined && entry.text !== '' && !entry.echo);
  const shown = said.filter((entry) => entry.shown).map((entry) => quote(entry.text));
  const hidden = said.filter((entry) => !entry.shown && matches(entry, wanted));
  return `shown labels say: ${shown.slice(0, 16).join(' ') || 'nothing'}${shown.length > 16 ? ' …' : ''}${hidden.length ? `; hidden and matching: ${hidden.slice(0, 3).map(describe).join('; ')}` : ''}`;
}

/** An expectation as written in a scenario, checked; throws on a slip of the pen. */
export function normalizeStageExpectation(value, what = 'expect') {
  const expectation = normalizeStageSelector(value, what, EXPECT_KEYS);
  if (!selects(expectation) && expectation.js === undefined)
    throw Error(`${what} names a node (name, text, textMatches, class) or gives "js"`);
  if (expectation.js !== undefined && typeof expectation.js !== 'string')
    throw Error(`${what}: "js" is an expression as a string`);
  if (expectation.visible !== undefined && typeof expectation.visible !== 'boolean')
    throw Error(`${what}: "visible" is true or false`);
  if (
    expectation.count !== undefined &&
    !(Number.isInteger(expectation.count) && expectation.count >= 0)
  )
    throw Error(`${what}: "count" is a whole number`);
  if (
    expectation.within !== undefined &&
    !(Number.isFinite(expectation.within) && expectation.within >= 0)
  )
    throw Error(`${what}: "within" is a number of seconds`);
  if (!selects(expectation))
    for (const key of ['visible', 'count', 'nth'])
      if (expectation[key] !== undefined) throw Error(`${what}: "${key}" needs a node to be named`);
  return expectation;
}

/**
 * Checks the part of an expectation that is about the stage against a report. Passes when
 * a shown node matches (`visible: false`: a hidden one), or exactly `count` of them.
 * Gives `{ pass, found }`, `found` being what was there, in words.
 */
export function checkStageExpectation(report, value) {
  const expectation = normalizeStageExpectation(value);
  if (!selects(expectation)) return { pass: true, found: 'no node asked for' };
  const got = findStageNodes(report, expectation, { shown: expectation.visible !== false });
  const pass = expectation.count === undefined ? got.length > 0 : got.length === expectation.count;
  if (pass)
    return {
      pass,
      found: got.length ? got.slice(0, 3).map(describe).join('; ') : 'none, as expected',
    };
  if (got.length)
    return {
      pass,
      found: `found ${got.length} where ${expectation.count} were expected: ${got.slice(0, 5).map(describe).join('; ')}`,
    };
  return { pass, found: describeStageNear(report, expectation) };
}

/** A scenario as read from its file, with the steps this module adds checked. Gives it back. */
export function checkScenario(steps) {
  if (!Array.isArray(steps)) throw Error('A scenario is a list of steps');
  steps.forEach((step, index) => {
    const at = `step ${index + 1}`;
    if (!step || typeof step !== 'object' || Array.isArray(step))
      throw Error(`${at} is not an object`);
    // An array is a point on the page, as before.
    if (step.click !== undefined && !Array.isArray(step.click)) {
      const selector = normalizeStageSelector(step.click, `${at}: click`);
      if (!selects(selector))
        throw Error(`${at}: click names a node (name, text, textMatches, class) or is [x, y]`);
    }
    if (step.expect !== undefined)
      for (const one of [step.expect].flat()) normalizeStageExpectation(one, `${at}: expect`);
    if (step.probe !== undefined && !/^[\w.-]+$/.test(String(step.probe)))
      throw Error(`${at}: probe is a file name without a folder (letters, digits, - _ .)`);
  });
  return steps;
}

/** Where a click on a node goes: the middle of it, or of what is shown inside a node without a size. */
export function stageClickPoint(entry) {
  const sized = (rect) => rect && rect[2] > 0 && rect[3] > 0;
  let rect = entry.rect;
  if (!sized(rect)) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const grow = (node) => {
      for (const child of node.children ?? []) {
        if (!child.visible) continue;
        if (sized(child.rect)) {
          x0 = Math.min(x0, child.rect[0]);
          y0 = Math.min(y0, child.rect[1]);
          x1 = Math.max(x1, child.rect[0] + child.rect[2]);
          y1 = Math.max(y1, child.rect[1] + child.rect[3]);
        }
        grow(child);
      }
    };
    grow(entry.node ?? entry);
    rect = x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }
  return rect ? [Math.round(rect[0] + rect[2] / 2), Math.round(rect[1] + rect[3] / 2)] : null;
}

/**
 * The named click and the expectation, for a scenario player. The player gives:
 *   evaluate(expression)   the page's answer, by value
 *   press(x, y, hold)      a click at a point of the page, in CSS pixels, held `hold` seconds
 *   advance(seconds)       lets the player's clock run (real time, or a virtual clock's frames)
 *   hook                   the page hook as an expression (`S` in an expectation's "js")
 *   total                  how many steps the scenario has, for the messages
 * A step that fails throws an Error that says which step it was and what was found.
 */
export function stageSteps({ evaluate, press, advance, hook = 'undefined', total }) {
  const at = (index) => `step ${index + 1}${total ? ` of ${total}` : ''}`;
  const probe = async (options) => {
    const report = await evaluate(stageProbeExpression(options));
    if (report?.ok !== true)
      throw Error(`the stage could not be read: ${report?.reason ?? 'the page gave nothing back'}`);
    return report;
  };
  const askPage = async (js) => {
    const got = await evaluate(
      `(() => { const S = ${hook}; const say = (v) => { try { const s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); } }; try { const v = (${js}); return { pass: !!v, found: say(v) }; } catch (e) { return { pass: false, found: 'it threw ' + String(e) }; } })()`,
    );
    return got ?? { pass: false, found: 'the page gave nothing back' };
  };
  const checkOnce = async (expectation) => {
    const stage = selects(expectation)
      ? checkStageExpectation(await probe(), expectation)
      : { pass: true, found: '' };
    if (!stage.pass || expectation.js === undefined) return stage;
    const page = await askPage(expectation.js);
    return {
      pass: page.pass,
      found: `${stage.found ? stage.found + '; ' : ''}the expression gave ${String(page.found).slice(0, 300)}`,
    };
  };
  return {
    probe,
    /**
     * Clicks the one shown node a selector picks; `hold` seconds keep the button down (a
     * control that listens for the press and the release, not for a click). Gives what it
     * did, for the log.
     */
    async click(value, index, hold = 0) {
      const selector = normalizeStageSelector(value, `${at(index)}: click`);
      const report = await probe();
      const found = findStageNodes(report, selector);
      const what = `${at(index)}: click ${JSON.stringify(selector)}`;
      if (!found.length) throw Error(`${what}: ${describeStageNear(report, selector)}`);
      if (found.length > 1)
        throw Error(
          `${what}: ${found.length} shown nodes match (say which with "nth"): ${found.slice(0, 5).map(describe).join('; ')}`,
        );
      const point = stageClickPoint(found[0]);
      if (!point) throw Error(`${what}: ${found[0].path} has no size on the page`);
      const [width, height] = report.view;
      if (
        point[0] < 0 ||
        point[1] < 0 ||
        (width && point[0] >= width) ||
        (height && point[1] >= height)
      )
        throw Error(
          `${what}: ${found[0].path} is off the page, at ${point.join(', ')} of ${width}×${height}`,
        );
      // Where a finger would land: on the canvas, or on something of the page above it.
      const cover = await evaluate(`(${zhudaStageCover.toString()})(${point[0]}, ${point[1]})`);
      if (cover)
        throw Error(
          `${what}: ${found[0].path} at ${point.join(', ')} is under the page element <${cover}>, which would take the click`,
        );
      await press(point[0], point[1], hold);
      return { click: selector, at: point, node: found[0].path };
    },
    /** Checks one expectation or a list of them; one with "within" is asked again as the clock runs. */
    async expect(value, index) {
      const list = [value]
        .flat()
        .map((one) => normalizeStageExpectation(one, `${at(index)}: expect`));
      let waited = 0;
      for (const expectation of list) {
        const { within = 0, ...asked } = expectation;
        let spent = 0;
        let result = await checkOnce(asked);
        while (!result.pass && spent < within) {
          const slice = Math.min(0.1, within - spent);
          await advance(slice);
          spent += slice;
          result = await checkOnce(asked);
        }
        waited += spent;
        if (!result.pass)
          throw Error(
            `${at(index)}: expected ${JSON.stringify(asked)}${within ? ` within ${within} s` : ''}: ${result.found}`,
          );
      }
      return { expect: list.length, waited: Math.round(waited * 100) / 100 };
    },
  };
}
