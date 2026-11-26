import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TutorialRunner,
  TutorialSeenTracker,
  chooseBubblePlacement,
  expandRect,
} from '../systems/tutorial/tutorial.ts';

function installMockLaya() {
  class MockGraphics {
    calls = [];
    clear() {
      this.calls.push(['clear']);
    }
    drawRect(...args) {
      this.calls.push(['rect', ...args]);
    }
    drawRoundRect(...args) {
      this.calls.push(['roundRect', ...args]);
    }
    drawCircle(...args) {
      this.calls.push(['circle', ...args]);
    }
    drawLine(...args) {
      this.calls.push(['line', ...args]);
    }
    drawPoly(...args) {
      this.calls.push(['poly', ...args]);
    }
    drawTexture(...args) {
      this.calls.push(['texture', ...args]);
    }
  }
  class MockSprite {
    children = [];
    graphics = new MockGraphics();
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    visible = true;
    mouseEnabled = false;
    destroyed = false;
    handlers = new Map();
    pos(x, y) {
      this.x = x;
      this.y = y;
    }
    size(w, h) {
      this.width = w;
      this.height = h;
    }
    addChild(c) {
      this.children.push(c);
      return c;
    }
    destroyChildren() {
      this.children.length = 0;
    }
    destroy() {
      this.destroyed = true;
      this.children.length = 0;
    }
    on(evt, _ctx, fn) {
      const arr = this.handlers.get(evt) ?? [];
      arr.push(fn);
      this.handlers.set(evt, arr);
    }
    emit(evt, payload) {
      for (const fn of this.handlers.get(evt) ?? []) fn(payload);
    }
  }
  class MockText extends MockSprite {
    font = '';
    fontSize = 18;
    color = '';
    bold = false;
    wordWrap = false;
    leading = 0;
    align = 'left';
    text = '';
    get textHeight() {
      return Math.max(24, Math.ceil((this.text.length * this.fontSize) / Math.max(120, this.width)) * (this.fontSize + 6));
    }
  }
  globalThis.Laya = {
    Sprite: MockSprite,
    Text: MockText,
    Event: { MOUSE_DOWN: 'mousedown' },
  };
}

test('TutorialRunner steps cleanly through next, event predicate acceptance & rejection nudges', () => {
  const mem = new Map();
  const seen = new TutorialSeenTracker({
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => {
      mem.set(k, v);
    },
  });
  const events = [];
  const targetBox = { x: 100, y: 200, width: 80, height: 80 };

  const runner = new TutorialRunner(
    [
      {
        id: 'intro',
        title: 'Welcome',
        body: 'Tap Next to start.',
        advance: 'next',
      },
      {
        id: 'tap_cell',
        title: 'Place item',
        body: 'Double-tap the highlighted tile.',
        target: () => targetBox,
        pad: 12,
        waitFor: 'cell_placed',
        gesture: { type: 'double-tap' },
        accept: (cell) => (cell === '1,2' ? true : { ok: false, rejectText: 'Try the glowing slot!' }),
      },
    ],
    {
      flowId: 'demo_ftue',
      seenTracker: seen,
      viewportWidth: 720,
      viewportHeight: 1280,
      onComplete: (id) => events.push(`complete:${id}`),
    },
  );

  assert.equal(seen.hasSeen('demo_ftue'), false);
  assert.equal(runner.start(), true);
  assert.equal(runner.snapshot().stepId, 'intro');

  // Unmatched event while on 'next' step does nothing
  assert.deepEqual(runner.emit('cell_placed', '1,2'), { handled: false, advanced: false });

  // Advance to interactive spotlight step
  assert.equal(runner.next(), true);
  const snap = runner.snapshot();
  assert.equal(snap.stepId, 'tap_cell');
  assert.deepEqual(snap.hole, { x: 88, y: 188, width: 104, height: 104 });
  assert.equal(snap.gesture?.type, 'double-tap');
  assert.equal(snap.strictTarget, true);
  assert.equal(snap.placement, 'bottom'); // hole at y=188 (upper half) -> bubble below

  // Wrong cell triggers non-destructive coach nudge banner that expires smoothly
  const wrong = runner.emit('cell_placed', '0,0');
  assert.equal(wrong.advanced, false);
  assert.equal(wrong.rejectedText, 'Try the glowing slot!');
  assert.equal(runner.snapshot().nudgeText, 'Try the glowing slot!');
  runner.update(3.0);
  assert.equal(runner.snapshot().nudgeText, null);

  // Correct cell completes the tutorial and marks seen
  const right = runner.emit('cell_placed', '1,2');
  assert.equal(right.advanced, true);
  assert.equal(runner.isActive, false);
  assert.equal(runner.snapshot().completed, true);
  assert.equal(seen.hasSeen('demo_ftue'), true);
  assert.deepEqual(events, ['complete:demo_ftue']);
});

test('TutorialSeenTracker survives failing storage adapters & supports skip', () => {
  const brokenSeen = new TutorialSeenTracker({
    get() {
      throw new Error('blocked');
    },
    set() {
      throw new Error('quota');
    },
  });
  const skipped = [];
  const runner = new TutorialRunner(
    [{ id: 's1', title: 'T', body: 'B', advance: 'next' }],
    { flowId: 'f1', seenTracker: brokenSeen, onSkip: (f, s) => skipped.push(`${f}:${s}`) },
  );
  runner.start();
  runner.skip();
  assert.equal(runner.isActive, false);
  assert.equal(runner.snapshot().skipped, true);
  assert.equal(brokenSeen.hasSeen('f1'), true);
  assert.deepEqual(skipped, ['f1:s1']);
  brokenSeen.reset('f1');
  assert.equal(brokenSeen.hasSeen('f1'), false);
});

test('Geometry helpers prevent hole/bubble collisions & StageTutorialCoach renders 4-panel cutout', async () => {
  installMockLaya();
  const { StageTutorialCoach } = await import('../2d/tutorial-coach/tutorial-coach.ts');

  assert.deepEqual(expandRect({ x: 4, y: 6, width: 40, height: 40 }, 10, 100, 100), {
    x: 0,
    y: 0,
    width: 60,
    height: 60,
  });
  assert.equal(chooseBubblePlacement({ x: 100, y: 900, width: 80, height: 80 }, 1280), 'top');

  const stage = new globalThis.Laya.Sprite();
  const coach = new StageTutorialCoach(stage, { width: 720, height: 1280, defaultDoneLabel: 'Let Play!' });

  const started = coach.show([
    {
      id: 'step_drag',
      title: 'Sweep to mark',
      body: 'Drag across empty slots.',
      target: { x: 200, y: 500, width: 160, height: 90 },
      strictTarget: true,
      gesture: { type: 'drag', from: { x: 220, y: 545 }, to: { x: 340, y: 545 } },
      highlights: [{ rect: { x: 400, y: 500, width: 80, height: 90 }, tone: 'blocked' }],
      waitFor: 'swept',
      showNextWithEvent: true,
    },
  ]);
  assert.equal(started, true);
  coach.update(0.25);

  const rep = coach.report();
  assert.equal(coach.root.mouseThrough, true, 'Tutorial root container must pass through clicks outside card & strict scrim');
  assert.equal(rep.active, true);
  assert.ok(rep.hole);
  assert.ok(rep.cardRect);
  // Card rectangle does NOT overlap the spotlight cutout hole!
  const overlapsHole =
    rep.cardRect.y < rep.hole.y + rep.hole.height && rep.cardRect.y + rep.cardRect.height > rep.hole.y;
  assert.equal(overlapsHole, false, 'Coach bubble must never cover the spotlight target hole');
  assert.ok(rep.nextButton);
  assert.ok(rep.skipButton);

  // Scrim outside hole emits nudge & blocks clicks when strictTarget=true
  let stopped = false;
  stage.children[0].children[0].emit('mousedown', {
    stopPropagation() {
      stopped = true;
    },
  });
  assert.equal(stopped, true);

  coach.emit('swept');
  assert.equal(coach.active, false);
  coach.dispose();
});
