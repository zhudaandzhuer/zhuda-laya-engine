import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  checkScenario,
  checkStageExpectation,
  describeStageNear,
  findStageNodes,
  listStageNodes,
  stageClickPoint,
  stageProbeExpression,
  stageSteps,
  zhudaStageProbe,
} from '../packages/compiler/stage-probe.mjs';

const repo = path.resolve(import.meta.dirname, '..');

// A stand-in for LayaAir's stage. Its classes are named as a minifier names them, so the
// probe cannot lean on a constructor's own name; a node maps a point to its parent the way
// a sprite does (pivot, scale, a turn in degrees, position).
function standIn({ canvas = { left: 10, top: 20, width: 360, height: 640 } } = {}) {
  const Point = class a {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  };
  const Sprite = class t {
    constructor(name = '') {
      Object.assign(this, { name, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
      Object.assign(this, { pivotX: 0, pivotY: 0, width: 0, height: 0, visible: true });
      Object.assign(this, { active: true, _children: [], _parent: null, _mouse: false });
    }
    get mouseEnabled() {
      return this._mouse;
    }
    hasListener(type) {
      return (this._heard ?? []).includes(type);
    }
    add(...children) {
      for (const child of children) {
        child._parent = this;
        this._children.push(child);
      }
      return this;
    }
    set(values) {
      return Object.assign(this, values);
    }
    localToGlobal(point) {
      for (let node = this; node && node._parent; node = node._parent) {
        const turn = (node.rotation * Math.PI) / 180;
        const x = (point.x - node.pivotX) * node.scaleX;
        const y = (point.y - node.pivotY) * node.scaleY;
        point.x = node.x + x * Math.cos(turn) - y * Math.sin(turn);
        point.y = node.y + x * Math.sin(turn) + y * Math.cos(turn);
      }
      return point;
    }
  };
  const Text = class r extends Sprite {
    constructor(text, name = '') {
      super(name);
      this.text = text;
    }
  };
  const Stage = class s extends Sprite {};
  // A game's own class: not in the namespace, so the probe reports the LayaAir class under it.
  class Fruit extends Sprite {}
  const stage = new Stage('').set({ width: 720, height: 1280 });
  const Laya = {
    stage,
    Point,
    Sprite,
    Text,
    Stage,
    version: '3.4.2',
    Browser: { mainCanvas: { source: { getBoundingClientRect: () => canvas } } },
  };
  return { Laya, Sprite, Text, Fruit, stage };
}

/** The title screen of a small game: a design root, a heading, two buttons, a hidden panel. */
function titleScreen(options) {
  const world = standIn(options);
  const { Sprite, Text, Fruit, stage } = world;
  const button = (name, x, y, w, h, label) =>
    new Sprite(name)
      .set({ x, y, width: w, height: h, _mouse: true })
      .add(new Text(label).set({ width: w, height: h }));
  const design = new Sprite('design');
  const heading = new Text('豬大果園').set({ y: 150, width: 720, height: 100 });
  const level = button('level-0', 110, 440, 500, 120, '第一園　20 步\n未通過');
  const mute = button('mute', 530, 30, 160, 56, '聲音：開');
  const panel = new Sprite('result').set({ visible: false });
  panel.add(button('again', 70, 720, 270, 96, '再一次'));
  const fruit = new Fruit('').set({ x: 24, y: 360 });
  fruit.getSelfBounds = () => ({ x: -6, y: -6, width: 684, height: 684 });
  const gone = new Sprite('gone').set({ _destroyed: true });
  stage.add(design.add(heading, level, mute, panel, fruit, gone));
  return { ...world, design, heading, level, mute, panel, fruit };
}

const probeOf = (world, options) => {
  globalThis.Laya = world.Laya;
  globalThis.innerWidth = 380;
  globalThis.innerHeight = 680;
  try {
    return zhudaStageProbe(options);
  } finally {
    delete globalThis.Laya;
    delete globalThis.innerWidth;
    delete globalThis.innerHeight;
  }
};

test('the probe gives the tree: names, LayaAir classes, what is shown, what takes the pointer, what a label says', () => {
  const report = probeOf(titleScreen());
  assert.equal(report.ok, true);
  assert.deepEqual(report.stage, [720, 1280]);
  assert.deepEqual(report.canvas, [10, 20, 360, 640]);
  assert.deepEqual(report.view, [380, 680]);
  assert.equal(report.turned, false);
  // The stage, design, heading, two buttons with a label each, the panel with a button and
  // its label, the fruit layer: 11. The destroyed child is not there.
  assert.equal(report.total, 11);
  assert.equal(report.shown, 8);
  assert.equal(report.truncated, false);
  assert.equal(report.root.class, 'Stage');
  const [design] = report.root.children;
  assert.deepEqual(
    design.children.map((n) => [n.name, n.class, n.visible, n.shown, n.mouseEnabled, n.text]),
    [
      ['', 'Text', true, true, false, '豬大果園'],
      ['level-0', 'Sprite', true, true, true, undefined],
      ['mute', 'Sprite', true, true, true, undefined],
      ['result', 'Sprite', false, false, false, undefined],
      // A class of the game's own is reported as the LayaAir class it extends.
      ['', 'Sprite', true, true, false, undefined],
    ],
  );
  // Under a hidden panel a node is visible itself and not shown.
  const again = design.children[3].children[0];
  assert.deepEqual([again.name, again.visible, again.shown], ['again', true, false]);
  assert.equal(again.children[0].text, '再一次');
});

test('a rectangle is the node on the page in CSS pixels: the canvas rectangle, every scale above it, a turn', () => {
  const world = titleScreen();
  let nodes = Object.fromEntries(
    listStageNodes(probeOf(world))
      .filter((n) => n.name)
      .map((n) => [n.name, n.rect]),
  );
  // 720 stage units across 360 CSS pixels: half, from the canvas corner at 10, 20.
  assert.deepEqual(nodes['level-0'], [65, 240, 250, 60]);
  assert.deepEqual(nodes.mute, [275, 35, 80, 28]);
  // A node without a size is a point; one that only draws is what it draws.
  assert.deepEqual(nodes.result, [10, 20, 0, 0]);
  const fruit = listStageNodes(probeOf(world)).find((n) => n.path.endsWith('Sprite[4]'));
  assert.deepEqual(fruit.rect, [19, 197, 342, 342]);

  // The design root scaled and moved (a design fitted into a wider stage), a pivot, a quarter turn.
  world.design.set({ scaleX: 0.5, scaleY: 0.5, x: 180, y: 0 });
  world.mute.set({ pivotX: 80, pivotY: 28, rotation: 90 });
  nodes = Object.fromEntries(
    listStageNodes(probeOf(world))
      .filter((n) => n.name)
      .map((n) => [n.name, n.rect]),
  );
  assert.deepEqual(nodes['level-0'], [127.5, 130, 125, 30]);
  // 160 × 56 about its middle, turned: 56 × 160 about the same middle (530, 30 in the design).
  assert.deepEqual(nodes.mute, [225.5, 7.5, 14, 40]);
});

test('a stage LayaAir has turned on the page is mapped by its own pointer matrix, backwards', () => {
  const world = titleScreen();
  // A 1280 × 720 stage shown turned on a 360 × 640 page: stage x runs down the page.
  world.stage.set({ width: 1280, height: 720, clientScaleX: 1, clientScaleY: 1 });
  world.stage._canvasTransform = { a: 0, b: 0.5, c: -0.5, d: 0, tx: 360, ty: 0 };
  const corner = new world.Sprite('corner').set({ x: 0, y: 0, width: 100, height: 40 });
  world.stage.add(corner);
  const report = probeOf(world);
  assert.equal(report.turned, true);
  assert.deepEqual(findStageNodes(report, 'corner')[0].rect, [340, 0, 20, 50]);
});

test('counts alone, a limit on the tree, and a page without a stage', () => {
  const world = titleScreen();
  assert.deepEqual(probeOf(world, { counts: true }), {
    ok: true,
    stage: [720, 1280],
    canvas: [10, 20, 360, 640],
    view: [380, 680],
    turned: false,
    total: 11,
    shown: 8,
  });
  const cut = probeOf(world, { maxNodes: 4 });
  assert.equal(cut.truncated, true);
  assert.equal(listStageNodes(cut).length, 4);
  assert.deepEqual(probeOf({ Laya: undefined }), {
    ok: false,
    reason: 'no Laya.stage on this page',
  });
});

test('the probe is sent as text and uses nothing of the module it is written in', () => {
  const world = titleScreen();
  const context = vm.createContext({ Laya: world.Laya, innerWidth: 380, innerHeight: 680 });
  // By value, as a browser gives it back.
  const report = JSON.parse(JSON.stringify(vm.runInContext(stageProbeExpression(), context)));
  assert.equal(report.total, 11);
  assert.deepEqual(findStageNodes(report, 'level-0')[0].rect, [65, 240, 250, 60]);
  assert.deepEqual(vm.runInContext(stageProbeExpression({ counts: true }), context).shown, 8);
  // Written for an old runtime: nothing newer than ES2017 in what the page is given.
  assert.doesNotMatch(zhudaStageProbe.toString(), /\?\.|\?\?/);
});

test('a selector picks a control by its name, a label by what it says, and a control by what is said inside it', () => {
  const report = probeOf(titleScreen());
  const paths = (selector, options) => findStageNodes(report, selector, options).map((n) => n.path);
  assert.deepEqual(paths('mute'), ['Stage/design/mute']);
  assert.deepEqual(paths({ name: 'mute' }), ['Stage/design/mute']);
  // The text alone is the label itself: one match, not the button and every node above it.
  assert.deepEqual(paths({ text: '聲音：開' }), ['Stage/design/mute/Text[0]']);
  assert.deepEqual(paths({ name: 'mute', text: '聲音：開' }), ['Stage/design/mute']);
  assert.deepEqual(paths({ name: 'mute', text: '聲音：關' }), []);
  assert.deepEqual(paths({ textMatches: '^第一園　\\d+ 步' }), ['Stage/design/level-0/Text[0]']);
  assert.deepEqual(paths({ class: 'Text' }).length, 3);
  assert.deepEqual(paths({ class: 'Text', nth: 1 }), ['Stage/design/level-0/Text[0]']);
  // Shown by default; the hidden ones on request; both with null.
  assert.deepEqual(paths('again'), []);
  assert.deepEqual(paths('again', { shown: false }), ['Stage/design/result/again']);
  assert.deepEqual(paths({ text: '再一次' }, { shown: null }).length, 1);
  assert.throws(() => findStageNodes(report, { nmae: 'mute' }), /unknown key "nmae"/);
  assert.throws(() => findStageNodes(report, { textMatches: '(' }), /not a regular expression/);
  assert.throws(() => listStageNodes({ ok: true, total: 3 }), /counts only/);
});

test('a node says which pointer events it listens for, and a Label with its Text inside is one label', async () => {
  const world = titleScreen();
  world.level._heard = ['click', 'mouseover'];
  // LayaAir's Label: a node that says the words and holds a Text that says them again.
  const label = new world.Text('前進', 'go').set({ x: 100, y: 900, width: 200, height: 60 });
  label.add(new world.Text('前進').set({ width: 200, height: 60 }));
  world.design.add(label);
  const report = probeOf(world);
  assert.deepEqual(findStageNodes(report, 'level-0')[0].listens, ['click']);
  assert.equal(findStageNodes(report, 'mute')[0].listens, undefined);
  assert.deepEqual(
    findStageNodes(report, { text: '前進' }).map((n) => n.path),
    ['Stage/design/go'],
  );
  assert.deepEqual(findStageNodes(report, 'go')[0].texts, ['前進']);
  // Asked for by class, the Text inside is still there.
  assert.equal(findStageNodes(report, { class: 'Text', text: '前進' }).length, 2);
  assert.doesNotMatch(describeStageNear(report, { text: '後退' }), /"前進" "前進"/);
  const { steps, done } = player(world);
  await steps.click({ text: '前進' }, 0);
  // Held: for a control that listens for the press and the release, not for a click.
  await steps.click({ text: '前進' }, 1, 0.2);
  assert.deepEqual(done.pressed, [
    [110, 485],
    [110, 485, 0.2],
  ]);
});

test('a label hidden inside a control is not what the control says', () => {
  const world = titleScreen();
  world.mute.add(new world.Text('靜音中').set({ visible: false }));
  const report = probeOf(world);
  assert.equal(findStageNodes(report, { name: 'mute', text: '靜音中' }).length, 0);
  assert.equal(findStageNodes(report, { name: 'mute', text: '聲音：開' }).length, 1);
});

test('an expectation passes or says what was found instead', () => {
  const report = probeOf(titleScreen());
  assert.equal(checkStageExpectation(report, { name: 'mute' }).pass, true);
  assert.equal(checkStageExpectation(report, { name: 'mute', text: '聲音：開' }).pass, true);
  assert.equal(checkStageExpectation(report, { text: '豐收！', count: 0 }).pass, true);
  assert.equal(checkStageExpectation(report, { name: 'again', visible: false }).pass, true);
  assert.equal(checkStageExpectation(report, { class: 'Text', count: 3 }).pass, true);

  const wrongText = checkStageExpectation(report, { name: 'mute', text: '聲音：關' });
  assert.equal(wrongText.pass, false);
  assert.match(wrongText.found, /found 1: Stage\/design\/mute \(shown, says "聲音：開"\)/);
  const hidden = checkStageExpectation(report, { name: 'again' });
  assert.equal(hidden.pass, false);
  assert.match(hidden.found, /Stage\/design\/result\/again \(hidden, says "再一次"\)/);
  const noName = checkStageExpectation(report, { name: 'menu' });
  assert.match(noName.found, /found no node named "menu"; shown names: design, level-0, mute/);
  const noText = checkStageExpectation(report, { text: '選單' });
  assert.match(
    noText.found,
    /shown labels say: "豬大果園" "第一園\u300020 步\\n未通過" "聲音：開"/,
  );
  const hiddenText = checkStageExpectation(report, { text: '再一次' });
  assert.match(hiddenText.found, /hidden and matching: Stage\/design\/result\/again\/Text\[0\]/);
  const tooMany = checkStageExpectation(report, { class: 'Text', count: 1 });
  assert.match(tooMany.found, /found 3 where 1 were expected/);
  assert.match(
    describeStageNear(report, { class: 'Button' }),
    /shown classes: Stage, Sprite, Text/,
  );

  for (const [bad, message] of [
    [{}, /names a node/],
    [{ visible: false }, /names a node/],
    [{ js: 'true', count: 1 }, /"count" needs a node/],
    [{ name: 'a', count: -1 }, /whole number/],
    [{ name: 'a', within: 'soon' }, /number of seconds/],
    [{ name: 'a', visible: 'no' }, /true or false/],
    [{ js: 3 }, /expression as a string/],
    [[1, 2], /a name or an object/],
  ])
    assert.throws(() => checkStageExpectation(report, bad), message);
});

test('scenario files written before these steps are read as before; a slip in a new step is named with its step', () => {
  const old = [
    { wait: 6.2, js: 'S.set({ autoplay: 10 })' },
    { click: [640, 360], wait: 0.3, shot: '01' },
    { drag: [10, 10, 200, 10], hold: 0.5 },
    { note: 'a key no player reads' },
  ];
  assert.equal(checkScenario(old), old);
  // Every scenario kept in the repository.
  let files = 0;
  for (const dir of ['prefabs/viewer2d/scenarios', 'prefabs/viewer3d/scenarios'])
    for (const file of fs.readdirSync(path.join(repo, dir)).filter((f) => f.endsWith('.json'))) {
      checkScenario(JSON.parse(fs.readFileSync(path.join(repo, dir, file), 'utf8')));
      files++;
    }
  assert.ok(files >= 30, String(files));
  const fine = [
    { click: 'level-0', wait: 1, expect: { name: 'menu' }, probe: 'board', shot: '02' },
    { click: { text: '選單' }, expect: [{ text: '豬大果園' }, { js: 'S.screen === "title"' }] },
  ];
  assert.equal(checkScenario(fine), fine);
  for (const [bad, message] of [
    [{ steps: [] }, /a list of steps/],
    [[{ click: { nmae: 'x' } }], /step 1: click has an unknown key "nmae"/],
    [[{ wait: 1 }, { click: { nth: 0 } }], /step 2: click names a node/],
    [[{ click: { name: 'x', visible: false } }], /step 1: click has an unknown key "visible"/],
    [[{ expect: { name: 'x', withn: 3 } }], /step 1: expect has an unknown key "withn"/],
    [[{ expect: [{ name: 'x' }, {}] }], /step 1: expect names a node/],
    [[{ probe: '../out' }], /step 1: probe is a file name/],
    [['wait'], /step 1 is not an object/],
  ])
    assert.throws(() => checkScenario(bad), message);
});

/** A player's three hands on a stand-in page: what was pressed, how long the clock ran. */
function player(world, { hook = { screen: 'title' }, onAdvance, document } = {}) {
  const context = vm.createContext({
    Laya: world.Laya,
    innerWidth: 380,
    innerHeight: 680,
    hook,
    document,
  });
  const done = { pressed: [], advanced: 0 };
  const steps = stageSteps({
    evaluate: async (expression) => vm.runInContext(expression, context),
    press: async (x, y, hold) => void done.pressed.push(hold ? [x, y, hold] : [x, y]),
    advance: async (seconds) => {
      done.advanced += seconds;
      onAdvance?.(done.advanced);
    },
    hook: 'hook',
    total: 9,
  });
  return { steps, done, hook };
}

test('a named click presses the middle of the one shown node, and says where', async () => {
  const world = titleScreen();
  const { steps, done } = player(world);
  assert.deepEqual(await steps.click('level-0', 0), {
    click: { name: 'level-0' },
    at: [190, 270],
    node: 'Stage/design/level-0',
  });
  // By what the label says: the middle of the label, which is the middle of its button.
  assert.deepEqual((await steps.click({ text: '聲音：開' }, 1)).at, [315, 49]);
  assert.deepEqual(done.pressed, [
    [190, 270],
    [315, 49],
  ]);
  // A named node without a size: the middle of what is shown inside it.
  const group = new world.Sprite('group').set({ x: 100, y: 1000 });
  group.add(
    new world.Sprite('').set({ width: 200, height: 40 }),
    new world.Sprite('').set({ x: 300, width: 100, height: 40 }),
    new world.Sprite('').set({ x: 900, width: 100, height: 40, visible: false }),
  );
  world.design.add(group);
  assert.deepEqual((await steps.click('group', 2)).at, [160, 530]);
  assert.deepEqual(stageClickPoint({ rect: [0, 0, 0, 0], children: [] }), null);
});

test('a click that cannot be made fails with its step and what is there', async () => {
  const world = titleScreen();
  const { steps, done } = player(world);
  await assert.rejects(
    steps.click('menu', 3),
    /^Error: step 4 of 9: click \{"name":"menu"\}: found no node named "menu"; shown names: design, level-0, mute$/,
  );
  await assert.rejects(steps.click('again', 3), /step 4 of 9: .*again \(hidden, says "再一次"\)/);
  await assert.rejects(
    steps.click({ class: 'Text' }, 4),
    /step 5 of 9: .*3 shown nodes match \(say which with "nth"\)/,
  );
  assert.deepEqual((await steps.click({ class: 'Text', nth: 2 }, 4)).at, [315, 49]);
  world.design.add(new world.Sprite('empty'));
  await assert.rejects(steps.click('empty', 5), /Stage\/design\/empty has no size on the page/);
  world.design.add(new world.Sprite('below').set({ y: 1400, width: 100, height: 100 }));
  await assert.rejects(steps.click('below', 6), /is off the page, at 35, 745 of 380×680/);
  assert.equal(done.pressed.length, 1);
  // A page element over the canvas at that point (a splash that has not gone) takes the click.
  const canvas = world.Laya.Browser.mainCanvas.source;
  let top = { tagName: 'DIV', id: 'zhudaLogoSplash', className: 'zhuda-splash-tribute fading ' };
  const covered = player(world, { document: { elementFromPoint: () => top } });
  await assert.rejects(
    covered.steps.click('mute', 7),
    /step 8 of 9: .*Stage\/design\/mute at 315, 49 is under the page element <div#zhudaLogoSplash\.zhuda-splash-tribute\.fading>, which would take the click/,
  );
  assert.equal(covered.done.pressed.length, 0);
  top = canvas;
  assert.deepEqual((await covered.steps.click('mute', 7)).at, [315, 49]);
  const noStage = player({ Laya: {} });
  await assert.rejects(noStage.steps.click('x', 0), /the stage could not be read: no Laya.stage/);
});

test('an expectation is checked at once, or again as the clock runs until its time is over', async () => {
  const world = titleScreen();
  const label = world.mute._children[0];
  const { steps, done, hook } = player(world, {
    onAdvance: (seconds) => {
      if (seconds >= 0.25) label.text = '聲音：關';
      if (seconds >= 0.45) hook.screen = 'play';
    },
  });
  assert.deepEqual(await steps.expect({ name: 'mute', text: '聲音：開' }, 0), {
    expect: 1,
    waited: 0,
  });
  assert.equal(done.advanced, 0);
  // Not yet so: asked again every tenth of a second of the player's clock.
  const waited = await steps.expect({ name: 'mute', text: '聲音：關', within: 2 }, 1);
  assert.deepEqual(waited, { expect: 1, waited: 0.3 });
  // A list: each in turn; an expression on the hook is `S`.
  const both = await steps.expect(
    [{ text: '聲音：關' }, { js: "S.screen === 'play'", within: 1 }, { text: '豐收！', count: 0 }],
    2,
  );
  assert.deepEqual(both, { expect: 3, waited: 0.2 });

  await assert.rejects(
    steps.expect({ name: 'mute', text: '聲音：開' }, 3),
    /^Error: step 4 of 9: expected \{"name":"mute","text":"聲音：開"\}: found 1: Stage\/design\/mute \(shown, says "聲音：關"\)$/,
  );
  const before = done.advanced;
  await assert.rejects(
    steps.expect({ text: '豐收！', within: 0.5 }, 4),
    /step 5 of 9: expected \{"text":"豐收！"\} within 0\.5 s: shown labels say: "豬大果園"/,
  );
  assert.ok(Math.abs(done.advanced - before - 0.5) < 1e-9, String(done.advanced - before));
  await assert.rejects(
    steps.expect({ js: 'S.screen' + " === 'result'" }, 5),
    /step 6 of 9: expected .*: the expression gave false/,
  );
  await assert.rejects(
    steps.expect({ js: 'S.game.score > 0' }, 6),
    /the expression gave it threw TypeError/,
  );
  // With a node and an expression, both hold; the node is looked for first.
  await assert.rejects(
    steps.expect({ name: 'menu', js: 'true' }, 7),
    /step 8 of 9: .*found no node named "menu"/,
  );
  assert.deepEqual(await steps.expect({ name: 'mute', js: 'S.screen' }, 8), {
    expect: 1,
    waited: 0,
  });
});

test('the two viewers play scenarios with the same file, and both players take the new steps', () => {
  const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
  assert.equal(read('prefabs/viewer2d/tools/play.mjs'), read('prefabs/viewer3d/tools/play.mjs'));
  for (const file of ['prefabs/viewer2d/tools/play.mjs', 'prefabs/tools/detplay.mjs']) {
    const text = read(file);
    for (const word of ['stage-probe.mjs', 'checkScenario', 'step.expect', 'step.probe'])
      assert.ok(text.includes(word), `${file}: ${word}`);
  }
});

test('the stage probe is a public entry of the package', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['./compiler/stage-probe'], './packages/compiler/stage-probe.mjs');
  assert.ok(fs.existsSync(path.join(repo, pkg.exports['./compiler/stage-probe'])));
});

test('the measuring script reports the stage node counts beside the DOM node count', async () => {
  const world = titleScreen();
  const context = vm.createContext({ Laya: world.Laya, innerWidth: 380, innerHeight: 680 });
  const asked = [];
  const cdp = {
    send: async (method) => {
      asked.push(method);
      return method === 'Performance.getMetrics'
        ? {
            metrics: [
              { name: 'JSHeapUsedSize', value: 20 * 1048576 },
              { name: 'JSHeapTotalSize', value: 32 * 1048576 },
              { name: 'Nodes', value: 14 },
              { name: 'JSEventListeners', value: 40 },
            ],
          }
        : {};
    },
  };
  // What the script is given by games/tools/shot.mjs, as far as it uses it. A string given
  // to evaluate is an expression run in the page: that is how the probe gets there.
  const page = {
    context: () => ({
      newCDPSession: async () => cdp,
      browser: () => ({ newBrowserCDPSession: async () => ({ send: async () => ({}) }) }),
    }),
    evaluate: async (script) =>
      typeof script === 'string' ? vm.runInContext(script, context) : [0, 16.7, 16.6, 16.7],
  };
  const log = [];
  const measure = (await import('../games/tools/device-measure.mjs')).default;
  await measure({
    page,
    shot: async () => {},
    state: async () => ({}),
    sleep: async () => {},
    log: (entry) => log.push(entry),
  });
  assert.equal(log.length, 1);
  assert.equal(log[0].memory.domNodes, 14);
  assert.equal(log[0].memory.stageNodes, 11);
  assert.equal(log[0].memory.stageNodesShown, 8);
  assert.ok(asked.includes('HeapProfiler.collectGarbage'));
  // A page that is not the engine's: the counts are null, the rest is still measured.
  page.evaluate = async (script) =>
    typeof script === 'string' ? vm.runInNewContext(script, {}) : [0, 16.7];
  await measure({
    page,
    shot: async () => {},
    state: async () => null,
    sleep: async () => {},
    log: (entry) => log.push(entry),
  });
  assert.equal(log[1].memory.stageNodes, null);
  assert.equal(log[1].memory.stageNodesShown, null);
  assert.equal(log[1].memory.domNodes, 14);
});
