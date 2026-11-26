// Run with Playwright and Chrome installed. Output stays outside the shipped payload.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ASHFALL_PLAYWRIGHT || "playwright");
const url = process.argv[2] || "http://127.0.0.1:4328/";
const output = resolve(process.argv[3] || "dist/qa/controls");
// ASHFALL_VIDEO=0 skips the duel recording (Playwright needs its own ffmpeg for it).
const recordVideo = process.env.ASHFALL_VIDEO !== "0";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--enable-unsafe-swiftshader"],
});
const issues = [];
const report = {
  url,
  browser: browser.version(),
  device:
    { win32: "Windows", darwin: "macOS" }[process.platform] ??
    process.platform,
  input: "Chromium 觸控模擬",
  layouts: {},
};
async function open(viewport, touch, dpr = 1, video = false) {
  video &&= recordVideo;
  const context = await browser.newContext({
    viewport,
    hasTouch: touch,
    isMobile: touch,
    deviceScaleFactor: dpr,
    ...(video ? { recordVideo: { dir: output, size: viewport } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(url).origin))
      issues.push(r.status() + " " + r.url());
  });
  await page.goto(url);
  await page.locator("#start").waitFor({ state: "visible" });
  await page.locator("#zhudaLogoSplash").waitFor({ state: "hidden" });
  await page.evaluate(() => {
    const root = Laya.stage.getChildByName("ZhudaRootScene").getChildAt(0);
    // Observe the same public draw commands that render the two actors.
    window.duelQA = () => {
      const hero = root.getChildByName("Knight").graphics.cmds[0];
      const foe = root.getChildByName("Warden").graphics.cmds[0];
      return {
        hero: hero.x,
        foe: foe.x,
        focus: root.x,
        scale: root.scaleX,
        feet: root.y + hero.y * root.scaleY,
      };
    };
  });
  return { context, page };
}
async function touchPoint(page, selector, id, x = 0.5) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(
    box && box.width >= 44 && box.height >= 44,
    selector + " 的觸控面積"
  );
  return {
    x: Math.round(box.x + box.width * x),
    y: Math.round(box.y + box.height / 2),
    id,
  };
}
const mode = (p) => p.locator("#theatre").getAttribute("data-mode");
const health = async (p) =>
  Number(await p.locator("#foe-hp").getAttribute("aria-valuenow"));
const read = (p) => p.evaluate(() => window.duelQA());
async function restart(p) {
  if ((await mode(p)) === "duel") await p.locator("#menu").tap();
  await p.locator("#restart").tap();
  assert.equal(await mode(p), "duel");
}
async function layout(p) {
  const sizes = await p.evaluate(() =>
    Object.fromEntries(
      [
        "#game canvas",
        "#stride-pad",
        "[data-touch=left]",
        "#strike-button",
        ".evade-button",
        "#menu",
        "#sound",
      ].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [s, [r.x, r.y, r.width, r.height].map(Math.round)];
      })
    )
  );
  const view = p.viewportSize();
  assert.deepEqual(sizes["#game canvas"], [0, 0, view.width, view.height]);
  for (const [name, [x, y, w, h]] of Object.entries(sizes)) {
    assert.ok(
      w >= 44 &&
        h >= 44 &&
        x >= 0 &&
        y >= 0 &&
        x + w <= view.width + 1 &&
        y + h <= view.height + 1,
      name
    );
  }
  const actor = await read(p);
  assert.ok(
    actor.hero * actor.scale + actor.focus >= 0 &&
      actor.foe * actor.scale + actor.focus <= view.width
  );
  return sizes;
}
try {
  const { context, page: p } = await open({ width: 390, height: 844 }, true, 2);
  await p.locator("#start").tap();
  report.releaseUrl = p.url();
  report.layouts.portrait = await layout(p);
  await p.screenshot({
    path: join(output, "portrait.jpg"),
    scale: "css",
    quality: 90,
  });
  const cdp = await context.newCDPSession(p);
  const touch = (type, ...touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  let left = await touchPoint(p, "#stride-pad", 1, 0.23),
    right = await touchPoint(p, "#stride-pad", 1, 0.77);
  let attack = await touchPoint(p, "#strike-button", 2);
  const atStart = (await read(p)).hero;
  await touch("touchStart", right);
  await p.waitForFunction((x) => window.duelQA().hero > x + 16, atStart);
  await touch("touchStart", right, attack);
  await p.waitForFunction(
    () => document.querySelector("#strike-button").dataset.held === "true"
  );
  await touch("touchMove", left, attack);
  await p.waitForFunction(
    () => document.querySelector("#stride-pad").dataset.direction === "left"
  );
  const reversed = (await read(p)).hero;
  await p.waitForFunction((x) => window.duelQA().hero < x - 8, reversed);
  await touch("touchEnd", left);
  assert.equal(
    await p.locator("#strike-button").getAttribute("data-held"),
    "true"
  );
  await p.waitForFunction(
    () =>
      document.querySelector("#strike-button small").textContent === "已蓄滿"
  );
  await touch("touchEnd", attack);
  await p.waitForFunction(
    () =>
      Number(document.querySelector("#foe-hp").getAttribute("aria-valuenow")) <
      100
  );
  report.twoFinger = {
    startX: atStart,
    turnedAt: reversed,
    guardHpAfterChargedHit: await health(p),
  };
  assert.equal(report.twoFinger.guardHpAfterChargedHit, 64);
  const tipAtImpact = [];
  for (const height of [315, 204]) {
    await restart(p);
    const frame = await read(p);
    await p.touchscreen.tap(
      Math.round(frame.focus + (frame.foe - 40) * frame.scale),
      Math.round(frame.feet - height * frame.scale)
    );
    const tip = await p.waitForFunction(() => {
      if (
        Number(
          document.querySelector("#foe-hp").getAttribute("aria-valuenow")
        ) === 100
      )
        return 0;
      const root = Laya.stage.getChildByName("ZhudaRootScene").getChildAt(0);
      const v = root.getChildByName("Blade").graphics.cmds[0].vertices;
      return (v[v.length - 3] + v[v.length - 1]) / 2;
    });
    tipAtImpact.push(await tip.jsonValue());
  }
  assert.ok(
    tipAtImpact[1] - tipAtImpact[0] > 35,
    "直向畫面點擊高低部位應改變劍尖的命中高度"
  );
  report.portraitAimTipY = tipAtImpact;
  await restart(p);
  await touch("touchStart", attack);
  await touch("touchCancel");
  await p.waitForFunction(
    () => document.querySelector("#strike-button").dataset.held === "false"
  );
  await p.waitForTimeout(320);
  assert.equal(await health(p), 100);
  assert.equal(
    await p.locator("#stamina").getAttribute("aria-valuenow"),
    "100"
  );
  await touch("touchStart", right);
  await touch("touchStart", right, attack);
  // A third finger on pause while both thumbs are down: a phone sends no click
  // then, so the button must answer the touch itself.
  await touch("touchStart", right, attack, await touchPoint(p, "#menu", 3));
  await touch("touchEnd");
  assert.equal(await mode(p), "paused");
  await p.locator("#primary").tap();
  assert.equal(
    await p.locator("#stride-pad").getAttribute("data-direction"),
    "idle"
  );
  assert.equal(
    await p.locator("#strike-button").getAttribute("data-held"),
    "false"
  );
  assert.equal(await health(p), 100);
  await touch("touchStart", right);
  await touch("touchStart", right, attack);
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForFunction(
    () =>
      document.querySelector("#stride-pad").dataset.direction === "idle" &&
      document.querySelector("#strike-button").dataset.held === "false"
  );
  await touch("touchEnd");
  assert.equal(await mode(p), "duel");
  await restart(p);
  report.layouts.landscape = await layout(p);
  await p.screenshot({
    path: join(output, "landscape.jpg"),
    scale: "css",
    quality: 90,
  });
  await p.locator("#strike-button").tap();
  await p.waitForFunction(
    () =>
      document.querySelector("#foe-hp").getAttribute("aria-valuenow") === "84"
  );
  const beforeEvade = (await read(p)).hero;
  await p.locator(".evade-button").tap();
  await p.waitForFunction((x) => window.duelQA().hero < x - 14, beforeEvade);
  await p.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await mode(p), "duel");
  await restart(p);
  await p.locator("#strike-button").focus();
  await p.keyboard.down("Space");
  assert.equal(
    await p.locator("#strike-button").getAttribute("data-held"),
    "true"
  );
  await p.keyboard.up("Space");
  await p.waitForFunction(
    () =>
      document.querySelector("#foe-hp").getAttribute("aria-valuenow") === "84"
  );
  await p.locator("#menu").tap();
  assert.ok(await p.locator(".touch-bindings").isVisible());
  assert.equal(await p.locator(".key-bindings").isVisible(), false);
  await context.close();

  const { context: desk, page: d } = await open(
    { width: 1280, height: 720 },
    false,
    1,
    true
  );
  await d.screenshot({ path: join(output, "title.jpg"), quality: 88 });
  report.engine = await d.evaluate(() => ({
    booted: window.__ZHUDA_ENGINE_BOOTED__,
    titleMark: document.querySelector(".engine-mark").alt,
  }));
  assert.ok(report.engine.booted);
  await d.locator("#start").click();
  await d.keyboard.down("KeyJ");
  await d.waitForFunction(
    () =>
      document.querySelector("#strike-button small").textContent === "已蓄滿"
  );
  await d.keyboard.up("KeyJ");
  await d.waitForFunction(
    () =>
      Number(document.querySelector("#foe-hp").getAttribute("aria-valuenow")) <
      100
  );
  report.desktopGuardHp = await health(d);
  await d.keyboard.press("KeyJ");
  await d.waitForTimeout(400);
  await d.keyboard.press("Space");
  await d.waitForTimeout(600);
  const afterBackstep = await read(d);
  await d.keyboard.down("KeyD");
  await d.waitForFunction(
    (x) => window.duelQA().hero > x + 18,
    afterBackstep.hero
  );
  await d.keyboard.up("KeyD");
  const aim = await d.evaluate(() => {
    const s = window.duelQA();
    return { x: s.focus + (s.foe - 40) * s.scale, y: s.feet - 250 * s.scale };
  });
  await d.mouse.click(aim.x, aim.y);
  await d.waitForTimeout(650);
  await d.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await mode(d), "paused");
  assert.ok(await d.locator(".key-bindings").isVisible());
  assert.equal(await d.locator(".touch-bindings").isVisible(), false);
  const video = d.video();
  await desk.close();
  if (video) {
    await video.saveAs(join(output, "duel.webm"));
    await video.delete();
  }
  assert.deepEqual(issues, []);
  report.passed = [
    "雙指同按",
    "移動中滑過中線反向",
    "先放移動保留蓄力",
    "滿蓄命中",
    "取消觸控不扣體力",
    "雙指按住時第三指暫停",
    "暫停清除雙指",
    "旋轉清除雙指",
    "橫向輕斬接閃避",
    "手機暫時失焦",
    "鍵盤操作觸控按鈕",
    "鍵鼠、暫停與重開",
  ];
  await writeFile(
    join(output, "controls.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
