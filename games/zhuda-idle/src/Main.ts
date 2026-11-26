// 豬大掛機傳 — the whole game on the engine's 2D stage (features core, 2d, ui): a 720 × 1280
// portrait design fitted to the screen, the engine's vector buttons and glass panels, its ready
// 2D effects, its session clock and timers, its one audio adapter. The rules are src/core/idle.ts.
//   index.html?tab=summon          open a tab straight away
//   index.html?demo=1              a sample save a few days in (not written back)
//   index.html?fresh=1             ignore the stored save
import { ZhudaEffect2D, ZhudaEngine, ZhudaUI } from 'zhuda-laya-engine';
import * as G from './core/idle.ts';
import { session } from './core/bot.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, clickable, designRoot, easeBack, hot, node, picture, preload, rect, redDot, refreshHot, short, text, tween } from './ui/kit.ts';

type Tab = 'battle' | 'heroes' | 'summon' | 'tasks' | 'gifts';
interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  save?: G.Save;
  power?: number;
  stagePower?: number;
  lastBattle?: { stage: number; win: boolean };
  lastPulls?: G.Pull[];
  effects: number;
  sound?: unknown;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot, effects: 0 });
const params = new URLSearchParams(location.search);
const W = 720, H = 1280;
const RARITY: Record<G.Rarity, { frame: string; glow: string; label: string }> = {
  R: { frame: '#5f8fd0', glow: '#2a4670', label: '#bcd6ff' },
  SR: { frame: '#b06ae0', glow: '#4b2470', label: '#e6c8ff' },
  SSR: { frame: '#f0b93a', glow: '#7a5210', label: '#fff0b8' },
};
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

async function main() {
  let fit = () => {};
  const context = await ZhudaEngine.boot({ container: '#game', features: ['core', '2d', 'ui'], dprCap: 2, targetFPS: 60, onResize: () => fit() });
  Laya.stage.bgColor = '#0d1018';
  const design = designRoot(W, H);
  fit = design.fit;
  const root = design.root;
  const sound = new Sound(storage?.getItem('zhuda-idle/muted') === '1');
  void sound.load();
  Laya.stage.on(Laya.Event.MOUSE_DOWN, null, () => sound.start('pointer'));
  await preload([...G.HEROES.map((h) => `assets/heroes/${h.id}.png`), ...[...G.ENEMIES, ...G.BOSSES].map((e) => `assets/enemies/${e}.jpg`)]);

  const now = () => Date.now() + clockSkew;
  let clockSkew = 0;
  let save = params.has('fresh') || params.has('demo') ? G.newSave(now()) : G.loadSave(storage, now());
  if (params.has('demo')) {
    // Three days of the bot's play, then two hours away.
    const t0 = now() - 3 * 86400_000;
    save = G.newSave(t0, 4242);
    for (let v = 0; v < 9; v++) session(save, t0 + v * 8 * 3600_000);
    save.afkFrom = now() - 2 * 3600_000;
    save.tickets += 12;
    G.rollDay(save, now());
  }
  G.rollDay(save, now());
  const persist = () => {
    report.save = save;
    report.power = G.teamPower(save);
    report.stagePower = G.stagePower(save.stage);
    if (params.has('demo')) return;
    try {
      storage?.setItem('zhuda-idle/save', JSON.stringify(save));
    } catch {
      /* private mode */
    }
  };

  // ---- layers: background, the tab's content, the bars, overlays, effects -----------------
  const bg = node(root, 0, 0, 'bg');
  bg.graphics.drawRect(0, 0, W, H, '#141926');
  for (let i = 0; i < 9; i++) bg.graphics.drawRect(0, 120 + i * 60, W, 60, i % 2 ? '#161c2b' : '#182033');
  let content = node(root, 0, 0, 'content');
  const top = node(root, 0, 0, 'top');
  const tabs = node(root, 0, H - 120, 'tabs');
  const overlay = node(root, 0, 0, 'overlay');
  const fxLayer = node(root, 0, 0, 'fx');
  fxLayer.mouseEnabled = false;
  const effects: { fx: ZhudaEffect2D; left: number }[] = [];
  const burst = (preset: string, x: number, y: number, scale = 1) => {
    const fx = new ZhudaEffect2D(fxLayer, preset, { x, y, scale, seed: (report.effects++ * 7919) % 100000 });
    effects.push({ fx, left: Math.max(0.8, fx.preset.seconds ?? 1.5) + 0.4 });
  };
  const toast = (message: string, color = '#ffe9a8') => {
    const t = text(overlay, message, { x: 0, y: 1100, w: W, size: 34, color, align: 'center', bold: true, stroke: '#000000' });
    tween(t, { y: 1060, alpha: 0 }, 1.6, undefined, () => t.destroy());
  };

  let tab: Tab = (params.get('tab') as Tab) ?? 'battle';
  let auto = false;
  let busy = false; // a battle or a summon is playing
  let detail: string | null = null;

  // ---- the bars --------------------------------------------------------------------------
  function drawTop() {
    top.destroyChildren();
    ZhudaUI.createGlassPanel(top, { x: 0, y: 0, width: W, height: 112, radius: 0, fillColor: '#0b0e16', borderColor: '#2c3550', borderWidth: 2 });
    text(top, '豬大掛機傳', { x: 20, y: 12, size: 30, bold: true, color: '#ffd978' });
    const vip = G.vipLevel(save);
    rect(top, 214, 14, 92, 32, '#b3261e', 8, '#ffd978');
    text(top, `VIP ${vip}`, { x: 214, y: 17, w: 92, size: 22, bold: true, align: 'center', color: '#fff3c4' });
    text(top, `戰力 ${short(G.teamPower(save))}`, { x: 330, y: 16, w: 370, size: 24, align: 'right', color: '#9fe3ff', bold: true });
    const cur = (x: number, label: string, value: string, color: string) => {
      rect(top, x, 62, 220, 38, '#1b2233', 19, '#39456a');
      text(top, label, { x: x + 14, y: 68, size: 22, color });
      text(top, value, { x: x + 60, y: 68, w: 148, size: 22, align: 'right' });
    };
    cur(14, '金幣', short(save.coins), '#ffd978');
    cur(250, '靈玉', short(save.jade), '#8fe0ff');
    cur(486, '召喚券', String(save.tickets), '#ffb0e0');
  }
  function drawTabs() {
    tabs.destroyChildren();
    rect(tabs, 0, 0, W, 120, '#0b0e16', 0, '#2c3550');
    const d = G.dots(save, now());
    const names: [Tab, string][] = [['battle', '戰鬥'], ['heroes', '英雄'], ['summon', '召喚'], ['tasks', '任務'], ['gifts', '福利']];
    names.forEach(([id, label], i) => {
      const b = button(tabs, 12 + i * 141, 16, 132, 84, label, tab === id ? 'gold' : 'dark', () => go(id), `tab-${id}`, d[id], 30);
      void b;
    });
  }
  function go(to: Tab) {
    if (busy) return;
    sound.play('tap', 0.4);
    tab = to;
    detail = null;
    draw();
  }

  // ---- cards -----------------------------------------------------------------------------
  function heroCard(parent: Laya.Sprite, id: string, x: number, y: number, size: number, own?: G.OwnedHero, onClick?: () => void, name?: string): Laya.Sprite {
    const def = G.hero(id), r = RARITY[def.rarity];
    const c = node(parent, x, y);
    c.graphics.drawRoundRect(0, 0, size, size * 1.25, 12, 12, 12, 12, r.glow, r.frame, 4);
    picture(c, `assets/heroes/${id}.png`, 6, 6, size - 12, size - 12);
    text(c, def.rarity, { x: 10, y: 8, size: Math.round(size * 0.16), bold: true, color: r.label, stroke: '#000000' });
    text(c, def.name, { x: 0, y: size - 4, w: size, size: Math.round(size * 0.15), align: 'center', bold: true });
    if (own) {
      text(c, `Lv.${own.level}`, { x: 0, y: size * 1.25 - size * 0.16 - 6, w: size - 8, size: Math.round(size * 0.12), align: 'right', color: '#cfe6ff' });
      if (own.stars) text(c, '★'.repeat(own.stars), { x: 8, y: size * 1.25 - size * 0.16 - 6, size: Math.round(size * 0.12), color: '#ffd24a' });
    } else {
      const veil = rect(c, 0, 0, size, size * 1.25, '#000000', 12);
      veil.alpha = 0.62;
      text(c, '未獲得', { x: 0, y: size * 0.48, w: size, size: Math.round(size * 0.15), align: 'center', color: '#b9c0d0' });
    }
    if (onClick) clickable(c, size, size * 1.25, onClick, name);
    return c;
  }

  // ---- battle tab ------------------------------------------------------------------------
  let afkText: Laya.Text | null = null;
  let stageBars: { team: Laya.Sprite; enemy: Laya.Sprite; enemyPic: Laya.Sprite; heroes: Map<string, Laya.Sprite> } | null = null;
  function drawBattle() {
    const stage = save.stage, enemy = G.stageEnemy(stage), boss = G.isBoss(stage);
    ZhudaUI.createGlassPanel(content, { x: 14, y: 126, width: W - 28, height: 560, radius: 18, fillColor: '#1a2136', borderColor: boss ? '#f0b93a' : '#3a4670', borderWidth: 3 });
    text(content, boss ? `第 ${stage} 關　首領` : `第 ${stage} 關`, { x: 0, y: 140, w: W, size: 34, bold: true, align: 'center', color: boss ? '#ffd978' : '#ffffff' });
    const mine = G.teamPower(save), theirs = G.stagePower(stage);
    text(content, `我方 ${short(mine)}`, { x: 40, y: 190, size: 24, color: mine >= theirs ? '#8ff0a0' : '#ff9a8a', bold: true });
    text(content, `${G.ENEMY_NAMES[enemy]} ${short(theirs)}`, { x: W - 340, y: 190, w: 300, size: 24, align: 'right', color: '#ffd0a0', bold: true });
    // Health bars
    const bar = (x: number, color: string) => {
      rect(content, x, 228, 300, 18, '#0a0d14', 9, '#4a5578');
      const fill = rect(content, x + 2, 230, 296, 14, color, 7);
      return fill;
    };
    const teamBar = bar(40, '#5fd070'), enemyBar = bar(W - 340, '#e0604a');
    // The team: front three, back two.
    const heroes = new Map<string, Laya.Sprite>();
    save.team.forEach((id, i) => {
      const front = i < 3;
      const c = heroCard(content, id, front ? 176 : 52, front ? 256 + i * 116 : 314 + (i - 3) * 116, 92, save.heroes[id]);
      heroes.set(id, c);
    });
    const size = boss ? 280 : 230;
    const pic = node(content, W - 60 - size, 430 - size / 2);
    pic.graphics.drawRoundRect(-6, -6, size + 12, size + 12, 16, 16, 16, 16, boss ? '#7a5210' : '#2a3350', boss ? '#f0b93a' : '#5a6890', 4);
    picture(pic, `assets/enemies/${enemy}.jpg`, 0, 0, size, size);
    stageBars = { team: teamBar, enemy: enemyBar, enemyPic: pic, heroes };

    button(content, 40, 610, 300, 64, mine >= theirs * 0.85 ? '挑　戰' : '戰力不足', mine >= theirs * 0.85 ? 'red' : 'off', () => void battle(), 'fight');
    button(content, 380, 610, 300, 64, auto ? '自動推圖：開' : '自動推圖：關', auto ? 'gold' : 'dark', () => ((auto = !auto), sound.play('tap', 0.4), draw(), auto && void battle()), 'auto');

    // The idle chest.
    ZhudaUI.createGlassPanel(content, { x: 14, y: 704, width: W - 28, height: 250, radius: 18, fillColor: '#1d2a22', borderColor: '#4a8060', borderWidth: 3 });
    text(content, '掛機寶箱', { x: 40, y: 720, size: 30, bold: true, color: '#b8ffcf' });
    text(content, `每分鐘 ${short(G.afkRate(save))} 金幣　上限 12 小時`, { x: 40, y: 764, w: 640, size: 22, color: '#9fc9ae' });
    afkText = text(content, '', { x: 40, y: 806, w: 640, size: 40, bold: true, color: '#ffd978' });
    button(content, 40, 872, 300, 64, '領　取', 'gold', claim, 'claim', G.afkMinutes(save, now()) >= 10);
    const quickLeft = G.QUICK_PER_DAY - save.daily.quick;
    button(content, 380, 872, 300, 64, `快速掛機 ${G.QUICK_COST}玉（${quickLeft}）`, quickLeft > 0 && save.jade >= G.QUICK_COST ? 'blue' : 'off', quick, 'quick', false, 22);
    // What to do next, in one line (a new player's guide).
    const hint = !save.loginClaimed ? '到「福利」領開局十連 →' : G.summonCost(save, 10) ? '到「召喚」抽十連 →' : G.dots(save, now()).heroes ? '到「英雄」一鍵升級、上陣 →' : mine < theirs ? '打不過就掛機：金幣會自己來' : '點「挑戰」推進關卡';
    text(content, hint, { x: 0, y: 980, w: W, size: 26, align: 'center', color: '#ffe9a8' });
    text(content, `本日：過關 ${save.daily.clears}・升級 ${save.daily.levels}・召喚 ${save.daily.summons}`, { x: 0, y: 1030, w: W, size: 20, align: 'center', color: '#7d88a6' });
  }
  function claim() {
    const coins = G.claimAfk(save, now());
    if (!coins) return toast('寶箱還是空的', '#b9c0d0');
    sound.play('coin', 0.7);
    burst('coin-burst', 190, 900, 1.6);
    toast(`金幣 +${short(coins)}`);
    persist();
    draw();
  }
  function quick() {
    const coins = G.quickAfk(save);
    if (!coins) return toast(save.daily.quick >= G.QUICK_PER_DAY ? '今天的次數用完了' : '靈玉不足', '#b9c0d0');
    sound.play('coin', 0.7);
    burst('coin-burst', 530, 900, 1.6);
    toast(`金幣 +${short(coins)}`);
    persist();
    draw();
  }

  const wait = (seconds: number) => new Promise<void>((done) => context.runtime.timers.scheduleOnce(seconds, done, { layer: 'ui' }));
  const fast = params.has('fast');
  async function battle() {
    if (busy || tab !== 'battle') return;
    if (G.teamPower(save) < G.stagePower(save.stage) * 0.85) {
      auto = false;
      toast('戰力不足：升級或召喚', '#ff9a8a');
      return draw();
    }
    busy = true;
    const b = G.fight(save);
    report.lastBattle = { stage: b.stage, win: b.win };
    const bars = stageBars!;
    const pace = fast || auto ? 0.16 : 0.34;
    for (const blow of b.blows) {
      if (tab !== 'battle' || !stageBars) break;
      const ex = bars.enemyPic.x + 120, ey = bars.enemyPic.y + 120;
      if (blow.by === 'enemy') {
        tween(bars.enemyPic, { x: bars.enemyPic.x - 60 }, pace * 0.4, undefined, () => tween(bars.enemyPic, { x: bars.enemyPic.x + 60 }, pace * 0.5));
        burst('hit-spark', 222, 430, 1.2);
        popDamage(222, 380, blow.damage, blow.crit, '#ff8a7a');
        tween(bars.team, { scaleX: blow.team }, pace * 0.6);
      } else {
        const card = bars.heroes.get(blow.by);
        if (card) tween(card, { x: card.x + 46 }, pace * 0.4, undefined, () => tween(card, { x: card.x - 46 }, pace * 0.5));
        burst(blow.crit ? 'explosion' : 'hit-spark', ex, ey, blow.crit ? 0.8 : 1.4);
        popDamage(ex, ey - 60, blow.damage, blow.crit, '#ffffff');
        tween(bars.enemy, { scaleX: blow.enemy }, pace * 0.6);
      }
      sound.play(blow.crit ? 'crit' : 'hit', 0.5);
      await wait(pace);
    }
    await wait(pace);
    if (b.win) {
      sound.play('win', 0.6);
      burst('confetti', W / 2, 300, 1.4);
      const r = b.rewards!;
      toast(`勝利　金幣 +${short(r.coins)}　靈玉 +${r.jade}${r.tickets ? '　召喚券 +1' : ''}`);
    } else {
      sound.play('lose', 0.6);
      auto = false;
      toast('敗北：升級、升星、召喚，或等掛機', '#ff9a8a');
    }
    persist();
    await wait(fast ? 0.2 : 0.7);
    busy = false;
    draw();
    if (auto && b.win) {
      G.levelAll(save);
      void battle();
    }
  }
  function popDamage(x: number, y: number, damage: number, crit: boolean, color: string) {
    const t = text(overlay, (crit ? '暴擊 ' : '') + short(damage), { x: x - 150, y, w: 300, size: crit ? 44 : 32, bold: true, align: 'center', color: crit ? '#ffcf3a' : color, stroke: '#000000' });
    tween(t, { y: y - 70, alpha: 0 }, 0.8, undefined, () => t.destroy());
  }

  // ---- heroes tab ------------------------------------------------------------------------
  function drawHeroes() {
    if (detail) return drawDetail(detail);
    text(content, `隊伍 ${save.team.length}/${G.TEAM_SIZE}　等級上限 ${G.maxLevel(save)}`, { x: 24, y: 130, size: 24, color: '#9fb0d8' });
    const d = G.dots(save, now());
    button(content, 24, 170, 320, 64, '一鍵升級', 'gold', () => {
      const n = G.levelAll(save);
      if (!n) return toast('金幣不足', '#b9c0d0');
      sound.play('level', 0.6);
      burst('level-up', W / 2, 520, 1.6);
      toast(`升級 ${n} 次`);
      persist();
      draw();
    }, 'level-all', save.team.some((id) => save.coins >= G.levelCost(save.heroes[id].level) && save.heroes[id].level < G.maxLevel(save)));
    button(content, 376, 170, 320, 64, '一鍵上陣', 'blue', () => {
      save.team = G.bestTeam(save);
      sound.play('tap', 0.5);
      toast('已換上最強的五人');
      persist();
      draw();
    }, 'best-team', d.heroes && G.bestTeam(save).join() !== save.team.join());
    const order = [...G.HEROES].sort((a, b) => Number(!!save.heroes[b.id]) - Number(!!save.heroes[a.id]) || (save.heroes[a.id] && save.heroes[b.id] ? G.heroPower(b.id, save.heroes[b.id]) - G.heroPower(a.id, save.heroes[a.id]) : 0));
    order.forEach((h, i) => {
      const x = 24 + (i % 4) * 170, y = 256 + Math.floor(i / 4) * 290;
      const own = save.heroes[h.id];
      const c = heroCard(content, h.id, x, y, 160, own, own ? () => ((detail = h.id), sound.play('tap', 0.4), draw()) : undefined, `hero-${h.id}`);
      if (save.team.includes(h.id)) {
        rect(c, 96, 6, 58, 28, '#2e9b4a', 6);
        text(c, '上陣', { x: 96, y: 9, w: 58, size: 18, align: 'center', bold: true });
      }
      if (own && own.stars < G.MAX_STARS && own.shards >= G.starCost(own.stars)) redDot(c, 152, 8);
      if (own) text(content, `戰力 ${short(G.heroPower(h.id, own))}`, { x, y: y + 206, w: 160, size: 18, align: 'center', color: '#9fe3ff' });
    });
  }
  function drawDetail(id: string) {
    const def = G.hero(id), own = save.heroes[id], r = RARITY[def.rarity];
    ZhudaUI.createGlassPanel(content, { x: 14, y: 126, width: W - 28, height: 1020, radius: 18, fillColor: '#1a2136', borderColor: r.frame, borderWidth: 3 });
    heroCard(content, id, 210, 150, 300, own);
    text(content, `${def.title}・${def.role}`, { x: 0, y: 540, w: W, size: 26, align: 'center', color: r.label });
    text(content, `戰力 ${short(G.heroPower(id, own))}`, { x: 0, y: 584, w: W, size: 36, align: 'center', bold: true, color: '#9fe3ff' });
    const cost = G.levelCost(own.level), capped = own.level >= G.maxLevel(save);
    button(content, 60, 660, 600, 72, capped ? `等級已達上限（通關可提高）` : `升級　${short(cost)} 金幣`, !capped && save.coins >= cost ? 'gold' : 'off', () => {
      if (!G.levelUp(save, id)) return toast(capped ? '先通關提高上限' : '金幣不足', '#b9c0d0');
      sound.play('level', 0.5);
      burst('sparkle', W / 2, 330, 1.6);
      persist();
      draw();
    }, 'level-up', false, 26);
    const sc = G.starCost(own.stars), maxed = own.stars >= G.MAX_STARS;
    button(content, 60, 752, 600, 72, maxed ? '已滿星' : `升星　碎片 ${own.shards}/${sc}`, !maxed && own.shards >= sc ? 'red' : 'off', () => {
      if (!G.starUp(save, id)) return toast('碎片不足：重複抽到會給碎片', '#b9c0d0');
      sound.play('gold', 0.6);
      burst('level-up', W / 2, 330, 2);
      persist();
      draw();
    }, 'star-up', !maxed && own.shards >= sc, 26);
    const inTeam = save.team.includes(id);
    button(content, 60, 844, 600, 72, inTeam ? '下　陣' : save.team.length >= G.TEAM_SIZE ? '上陣（換下最弱的）' : '上　陣', 'blue', () => {
      if (inTeam) {
        if (save.team.length <= 1) return toast('至少留一人', '#b9c0d0');
        save.team = save.team.filter((t) => t !== id);
      } else {
        if (save.team.length >= G.TEAM_SIZE) {
          const weakest = [...save.team].sort((a, b) => G.heroPower(a, save.heroes[a]) - G.heroPower(b, save.heroes[b]))[0];
          save.team = save.team.filter((t) => t !== weakest);
        }
        save.team.push(id);
      }
      sound.play('tap', 0.5);
      persist();
      draw();
    }, 'team-toggle', false, 26);
    button(content, 60, 1040, 600, 72, '返　回', 'dark', () => ((detail = null), draw()), 'back');
  }

  // ---- summon tab ------------------------------------------------------------------------
  function drawSummon() {
    ZhudaUI.createGlassPanel(content, { x: 14, y: 126, width: W - 28, height: 560, radius: 18, fillColor: '#2a1b3a', borderColor: '#b06ae0', borderWidth: 3 });
    text(content, '九野契師召喚', { x: 0, y: 144, w: W, size: 38, bold: true, align: 'center', color: '#ffe9a8' });
    ['shen-yan', 'ye-shuang', 'xuan-heng'].forEach((id, i) => heroCard(content, id, 60 + i * 210, 208, 180, save.heroes[id] ?? { level: 1, stars: 0, shards: 0 }));
    const left = G.HARD_PITY - save.pity;
    text(content, `再 ${left} 抽內必出 SSR`, { x: 0, y: 452, w: W, size: 28, align: 'center', bold: true, color: '#ffd24a' });
    rect(content, 110, 496, 500, 16, '#0a0d14', 8, '#6a4a90');
    rect(content, 112, 498, Math.max(4, 496 * (save.pity / G.HARD_PITY)), 12, '#f0b93a', 6);
    text(content, `機率公開：SSR ${(G.RATES.SSR * 100).toFixed(0)}%・SR ${(G.RATES.SR * 100).toFixed(0)}%・R ${(G.RATES.R * 100).toFixed(0)}%`, { x: 0, y: 530, w: W, size: 22, align: 'center', color: '#d9c8f0' });
    text(content, `第 ${G.SOFT_PITY} 抽起 SSR 機率逐抽提高，第 ${G.HARD_PITY} 抽必出；每 10 抽必出 SR 以上`, { x: 40, y: 566, w: 640, size: 20, align: 'center', color: '#b8a8d0', wrap: true });
    text(content, '重複的契師會變成碎片，用來升星。這個遊戲沒有儲值：券和靈玉都從遊玩得到。', { x: 40, y: 622, w: 640, size: 20, align: 'center', color: '#b8a8d0', wrap: true });
    const c1 = G.summonCost(save, 1), c10 = G.summonCost(save, 10);
    const label = (c: { tickets: number; jade: number } | null, n: number) => (c ? (c.jade ? `${c.tickets ? `券${c.tickets}＋` : ''}${c.jade}玉` : `券 ×${c.tickets}`) : `需 ${n * G.PULL_JADE} 玉`);
    button(content, 40, 720, 300, 96, `單抽\n${label(c1, 1)}`, c1 ? 'blue' : 'off', () => void pull(1), 'pull-1', false, 26);
    button(content, 380, 720, 300, 96, `十連\n${label(c10, 10)}`, c10 ? 'gold' : 'off', () => void pull(10), 'pull-10', !!c10, 26);
    text(content, `累計 ${save.pulls} 抽・已收集 ${Object.keys(save.heroes).length}/${G.HEROES.length}`, { x: 0, y: 846, w: W, size: 22, align: 'center', color: '#7d88a6' });
  }
  async function pull(count: 1 | 10) {
    if (busy) return;
    const pulls = G.summon(save, count);
    if (!pulls) return toast('券和靈玉都不夠：推關、做任務', '#b9c0d0');
    busy = true;
    report.lastPulls = pulls;
    persist();
    drawTop();
    // The reveal: a dark sheet, cards face down, turned one by one; an SSR stops the row for a moment.
    const sheet = node(overlay, 0, 0, 'reveal');
    const veil = rect(sheet, 0, 0, W, H, '#05060a');
    veil.alpha = 0.92;
    clickable(veil, W, H, () => {});
    text(sheet, count === 10 ? '十連召喚' : '召喚', { x: 0, y: 150, w: W, size: 40, bold: true, align: 'center', color: '#ffe9a8' });
    const size = count === 1 ? 300 : 124;
    for (let i = 0; i < pulls.length; i++) {
      const p = pulls[i], r = RARITY[p.rarity];
      const x = count === 1 ? 210 : 36 + (i % 5) * 132, y = count === 1 ? 380 : 300 + Math.floor(i / 5) * 230;
      const back = rect(sheet, x, y, size, size * 1.25, r.glow, 12, r.frame, 4);
      text(back, '契', { x: 0, y: size * 0.38, w: size, size: Math.round(size * 0.4), align: 'center', color: r.frame, bold: true });
      sound.play('flip', 0.4);
      await wait(fast ? 0.03 : 0.16);
      if (p.rarity === 'SSR') {
        sound.play('gold', 0.8);
        burst('level-up', x + size / 2, y + size * 0.6, 2);
        burst('confetti', W / 2, 260, 1.6);
        await wait(fast ? 0.05 : 0.7);
      } else if (p.rarity === 'SR') {
        sound.play('purple', 0.5);
        burst('sparkle', x + size / 2, y + size * 0.6, 1.4);
      }
      back.destroy();
      const card = heroCard(sheet, p.id, x, y, size, save.heroes[p.id]);
      card.scaleX = card.scaleY = 0.6;
      card.pivot(size / 2, size * 0.625);
      card.pos(x + size / 2, y + size * 0.625);
      tween(card, { scaleX: 1, scaleY: 1 }, 0.25, easeBack);
      const tag = p.isNew ? '新！' : `碎片 +${p.shards}`;
      text(sheet, tag, { x: x - 20, y: y + size * 1.25 + 4, w: size + 40, size: count === 1 ? 28 : 18, align: 'center', color: p.isNew ? '#8ff0a0' : '#b9c0d0', bold: p.isNew });
    }
    await wait(fast ? 0.1 : 0.4);
    button(sheet, 210, 1080, 300, 80, '確　定', 'gold', () => {
      sheet.destroy();
      busy = false;
      draw();
    }, 'reveal-ok', false, 30);
    refreshHot();
  }

  // ---- tasks and gifts -------------------------------------------------------------------
  function drawTasks() {
    text(content, '每日任務（每天重置）', { x: 24, y: 134, size: 28, bold: true, color: '#ffe9a8' });
    G.TASKS.forEach((t, i) => {
      const y = 190 + i * 150, have = Math.min(t.need, t.progress(save)), done = save.daily.claimed.includes(t.id);
      ZhudaUI.createGlassPanel(content, { x: 14, y, width: W - 28, height: 132, radius: 16, fillColor: '#1a2136', borderColor: '#3a4670', borderWidth: 2 });
      text(content, t.text, { x: 36, y: y + 18, size: 28, bold: true });
      text(content, `靈玉 ×${t.jade}`, { x: 36, y: y + 60, size: 22, color: '#8fe0ff' });
      rect(content, 36, y + 98, 380, 14, '#0a0d14', 7, '#4a5578');
      rect(content, 38, y + 100, Math.max(4, 376 * (have / t.need)), 10, '#5fd070', 5);
      text(content, `${have}/${t.need}`, { x: 300, y: y + 60, w: 116, size: 22, align: 'right', color: '#9fb0d8' });
      button(content, 470, y + 30, 210, 72, done ? '已領取' : have >= t.need ? '領　取' : '進行中', done ? 'off' : have >= t.need ? 'gold' : 'dark', () => {
        if (!G.claimTask(save, t.id)) return;
        sound.play('coin', 0.6);
        burst('coin-burst', 575, y + 66, 1.2);
        persist();
        draw();
      }, `task-${t.id}`, !done && have >= t.need);
    });
  }
  function drawGifts() {
    text(content, '開服七日簽到', { x: 24, y: 134, size: 28, bold: true, color: '#ffe9a8' });
    G.LOGIN.forEach((g, i) => {
      const x = 24 + (i % 4) * 170, y = 186 + Math.floor(i / 4) * 190, got = i < save.loginClaimed, open = i < Math.min(save.loginDays, G.LOGIN.length);
      rect(content, x, y, 160, 172, got ? '#22283a' : open ? '#3a2f14' : '#1a2136', 14, got ? '#3a4670' : open ? '#f0b93a' : '#3a4670', 3);
      text(content, `第 ${i + 1} 天`, { x, y: y + 12, w: 160, size: 24, align: 'center', bold: true, color: got ? '#7d88a6' : '#ffe9a8' });
      text(content, g.text, { x: x + 8, y: y + 58, w: 144, size: 20, align: 'center', wrap: true, color: got ? '#7d88a6' : '#ffffff' });
      text(content, got ? '已領' : open ? '可領' : '未到', { x, y: y + 134, w: 160, size: 20, align: 'center', color: got ? '#7d88a6' : open ? '#8ff0a0' : '#7d88a6' });
    });
    const can = save.loginClaimed < Math.min(save.loginDays, G.LOGIN.length);
    button(content, 60, 580, 600, 76, can ? `領取第 ${save.loginClaimed + 1} 天` : '明天再來', can ? 'gold' : 'off', () => {
      if (!G.claimLogin(save)) return;
      sound.play('gold', 0.6);
      burst('confetti', W / 2, 400, 1.4);
      toast(G.LOGIN[save.loginClaimed - 1].text);
      persist();
      draw();
    }, 'login', can, 28);
    const vip = G.vipLevel(save), next = G.VIP_STEPS[vip + 1];
    ZhudaUI.createGlassPanel(content, { x: 14, y: 690, width: W - 28, height: 250, radius: 18, fillColor: '#3a1614', borderColor: '#ffd978', borderWidth: 3 });
    text(content, `VIP ${vip}`, { x: 40, y: 708, size: 44, bold: true, color: '#ffe9a8' });
    text(content, `掛機收益 +${vip * 5}%`, { x: 300, y: 722, w: 380, size: 26, align: 'right', color: '#b8ffcf' });
    text(content, 'VIP 經驗只從遊玩得到：過關 +2、首領 +10、每抽 +1。', { x: 40, y: 780, w: 640, size: 22, color: '#f0c8b8', wrap: true });
    if (next) {
      rect(content, 40, 850, 640, 18, '#0a0d14', 9, '#7a5210');
      rect(content, 42, 852, Math.max(4, 636 * ((save.vipExp - G.VIP_STEPS[vip]) / (next - G.VIP_STEPS[vip]))), 14, '#ffd24a', 7);
      text(content, `${save.vipExp}/${next}`, { x: 40, y: 884, w: 640, size: 22, align: 'center', color: '#ffe9a8' });
    } else text(content, '已達最高等級', { x: 40, y: 860, w: 640, size: 24, align: 'center', color: '#ffe9a8' });
    button(content, 500, 1070, 196, 56, sound.muted ? '聲音：關' : '聲音：開', 'dark', () => {
      sound.setMuted(!sound.muted);
      storage?.setItem('zhuda-idle/muted', sound.muted ? '1' : '0');
      draw();
    }, 'mute', false, 22);
  }

  function draw() {
    content.destroy();
    content = node(root, 0, 0, 'content');
    root.setChildIndex(content, 1);
    afkText = null;
    stageBars = null;
    report.screen = detail ? `hero:${detail}` : tab;
    ({ battle: drawBattle, heroes: drawHeroes, summon: drawSummon, tasks: drawTasks, gifts: drawGifts })[tab]();
    drawTop();
    drawTabs();
    persist();
    refreshHot();
  }

  let second = 0;
  context.runtime.start((dt) => {
    const ui = context.runtime.layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(ui);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(ui);
      e.fx.render();
      if ((e.left -= ui) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    if (afkText) {
      const minutes = G.afkMinutes(save, now());
      afkText.text = `${short(G.afkPending(save, now()))} 金幣（${Math.floor(minutes / 60)} 時 ${Math.floor(minutes % 60)} 分${minutes >= G.AFK_CAP_MIN ? '・已滿' : ''}）`;
    }
    if ((second += ui) >= 1) {
      second = 0;
      if (G.rollDay(save, now())) draw();
      else if (!busy) drawTabs(), refreshHot();
    }
    report.frames++;
  });
  // For recorded runs: move the clock forward (the idle chest fills, the day may change).
  (window as any).__skip = (hours: number) => {
    clockSkew += hours * 3600_000;
    if (G.rollDay(save, now())) draw();
  };
  draw();
  report.sound = sound.diagnostics();
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
