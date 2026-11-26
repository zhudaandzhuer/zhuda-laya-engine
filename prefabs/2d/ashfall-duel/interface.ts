/**
 * 「灰燼之庭」 controls and screen: keyboard (A/D or arrows, J, Space, Enter, Esc, M), mouse
 * (press on the battlefield to charge, release to cut; the press height picks the plate),
 * two-thumb touch (a move pad that turns when the thumb slides across its middle, an
 * attack button that charges while held, an evade button), the pause / help / result
 * menu, the sound settings (remembered in localStorage) and the meters. The page must
 * have the nodes of court-page.ts. Uses prefabs input/hold-input, ui/game-menu,
 * ui/settings-form, ui/dom and systems/storage.
 */
import type { IframeSoundAdapter } from "zhuda-laya-engine";
import {
  createHoldInput,
  padDirection,
  type HoldDetail,
} from "../../input/hold-input.ts";
import { readJSON, writeJSON } from "../../systems/storage.ts";
import { press } from "../../ui/dom.ts";
import {
  createGameMenu,
  type MenuItem,
} from "../../ui/game-menu/game-menu.ts";
import { createSettingsForm } from "../../ui/settings-form/settings-form.ts";
import type { Duel, CombatEvent } from "./combat.ts";
import type { Point } from "./motion.ts";

const element = <T extends HTMLElement = HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw Error("缺少介面元件 " + id);
  return node as T;
};
type Role = "move" | "attack" | "evade";
const sounds = ["swing", "impact", "step", "evade"] as const;

/** Where the sound settings are remembered (localStorage key). */
export const SOUND_KEY = "ashfall-duel.sound";
type SoundSettings = { muted: boolean; volume: number };
function storedSound(): SoundSettings {
  const saved = readJSON(SOUND_KEY) as Partial<SoundSettings> | null;
  const volume = Number(saved?.volume);
  return {
    muted: saved?.muted === true,
    volume: Number.isFinite(volume)
      ? Math.min(100, Math.max(0, Math.round(volume)))
      : 100,
  };
}

export class Controls {
  private area = element("game");
  private stage = element("theatre");
  private overlay = element("overlay");
  private title = element("dialog-title");
  private result = element("result-line");
  private help = false;
  private keys = new Set<string>();
  private pad = element("stride-pad");
  private strike = element("strike-button");
  private strikeHint = this.strike.querySelector("small")!;
  private padDirection = 0;
  private chargePercent = -1;
  private evadeButton = document.querySelector<HTMLButtonElement>(
    '[data-touch="evade"]'
  )!;
  private soundReady = new Set<string>();
  private loadAudio: Promise<void> | undefined;
  private serial = 0;
  private meters = [element("hp"), element("stamina"), element("foe-hp")];
  private meterValues = [-1, -1, -1];
  private renderedState = "";
  private sound = storedSound();
  private holds;
  private menu;
  private soundForm;
  private game: Duel;
  private audio: IframeSoundAdapter;
  private signal: AbortSignal;
  private resetScene: () => void;
  private worldAt: (point: Point) => Point;
  constructor(
    game: Duel,
    audio: IframeSoundAdapter,
    signal: AbortSignal,
    resetScene: () => void,
    worldAt: (point: Point) => Point
  ) {
    this.game = game;
    this.audio = audio;
    this.signal = signal;
    this.resetScene = resetScene;
    this.worldAt = worldAt;
    const options = { signal };
    this.applySound();
    this.holds = createHoldInput<Role>({
      signal,
      begin: (role, detail) => this.begin(role, detail),
      end: (role, cancelled, detail) => this.finish(role, cancelled, detail),
    });
    this.menu = createGameMenu({
      host: element("dialog-menu"),
      className: "court-menu",
      backLabel: "← 返回",
      shown: false,
      items: [],
      onBack: () => this.toggleMenu(),
    });
    signal.addEventListener("abort", () => this.menu.dispose(), {
      once: true,
    });
    this.soundForm = createSettingsForm({
      fields: [
        { key: "on", label: "音效", type: "toggle" },
        {
          key: "volume",
          label: "音量",
          type: "range",
          min: 0,
          max: 100,
          step: 5,
          format: (value) => value + "%",
        },
      ],
      get: () => ({ on: !this.sound.muted, volume: this.sound.volume }),
      change: (patch) =>
        this.changeSound({
          ...("on" in patch ? { muted: !patch.on } : {}),
          ...("volume" in patch ? { volume: Number(patch.volume) } : {}),
        }),
      status: { saved: "已記住設定", unsaved: "這次有效，關閉後不會保留" },
      reset: { label: "還原預設", values: { on: true, volume: 100 } },
    });
    const start = () => this.start();
    // press() answers the touch itself: a phone only turns a tap into a click
    // when no other finger is down, and a thumb is usually on the move pad.
    press(element("start"), start);
    press(element("menu"), () => this.toggleMenu());
    press(element("sound"), () => this.toggleSound());
    window.addEventListener("keydown", (e) => this.keyDown(e), options);
    window.addEventListener(
      "keyup",
      (e) => {
        this.keys.delete(e.code);
        this.updateMovement();
        this.holds.releaseSource(e.code);
      },
      options
    );
    window.addEventListener(
      "blur",
      () => {
        if (!matchMedia("(pointer: coarse)").matches) this.blur();
      },
      options
    );
    matchMedia("(orientation: portrait)").addEventListener(
      "change",
      () => this.clear(),
      options
    );
    signal.addEventListener("abort", () => this.clear(), { once: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.blur();
      },
      options
    );
    this.area.addEventListener(
      "contextmenu",
      (e) => e.preventDefault(),
      options
    );
    const accept = () => {
      if (this.help || !this.overlay.hidden) return false;
      if (this.game.mode === "title") this.start();
      return this.game.mode === "duel";
    };
    this.holds.bind(this.area, "attack", { accept });
    this.holds.bind(this.pad, "move", {
      accept,
      move: (e) => this.slide(e.clientX),
    });
    this.holds.bind(this.strike, "attack", { accept });
    this.holds.bind(this.evadeButton, "evade", { accept });
    // Assistive technology may activate a button without sending a pointer or key.
    // (Array.from: the library's DOM typings have no NodeList iterator.)
    for (const button of Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-touch]")
    )) {
      button.addEventListener(
        "click",
        (e) => {
          if (e.detail !== 0 || this.game.mode !== "duel") return;
          const action = button.dataset.touch;
          if (action === "attack" && !this.holds.held("attack")) {
            this.game.press();
            this.game.release();
          } else if (action === "evade") this.game.evade();
        },
        options
      );
    }
  }

  private unlock(): void {
    this.audio.unlockAudio("duel-input");
    if (!this.loadAudio)
      this.loadAudio = Promise.all(
        sounds.map(async (name) => {
          try {
            await this.audio.loadSample("sound/" + name + ".wav", {
              signal: this.signal,
            });
            if (!this.signal.aborted) this.soundReady.add(name);
          } catch (error) {
            if (!this.signal.aborted) console.warn("音效載入失敗", name, error);
          }
        })
      ).then(() => {});
  }
  play(event: CombatEvent): void {
    const sample = event.kind === "hurt" ? "impact" : event.kind;
    if (this.game.mode === "title" || !this.soundReady.has(sample)) return;
    this.audio.playSample({
      id: "court-" + ++this.serial,
      sampleId: "sound/" + sample + ".wav",
      channel: "sfx",
      peakGain: Math.min(
        0.88,
        event.strength * (sample === "step" ? 0.38 : 0.78)
      ),
    });
  }
  /** Puts the remembered sound settings on the mixer and the sound button. */
  private applySound(): void {
    const { muted, volume } = this.sound;
    this.audio.setMuted(muted);
    this.audio.setChannelVolume("sfx", volume / 100);
    const button = element("sound");
    button.setAttribute("aria-pressed", String(muted));
    button.setAttribute("aria-label", muted ? "開啟音效" : "關閉音效");
  }
  /** A player's change: applied at once; returns whether it was remembered. */
  private changeSound(patch: Partial<SoundSettings>): boolean {
    this.sound = { ...this.sound, ...patch };
    this.applySound();
    if (!this.sound.muted) this.unlock();
    this.soundForm?.refresh();
    return writeJSON(SOUND_KEY, this.sound);
  }
  private toggleSound(): void {
    this.changeSound({ muted: !this.sound.muted });
  }
  /** Opens the sound settings panel of the menu (the menu must be shown). */
  openSound(): void {
    this.menu.open({
      id: "sound",
      title: "音效設定",
      body: this.soundForm.root,
      onOpen: () => this.soundForm.refresh(),
    });
  }
  /** 「開始決鬥」: a fresh duel (also what Enter, J on the title and 「再戰一場」 do). */
  start(): void {
    this.unlock();
    this.help = false;
    this.clear();
    this.game.reset();
    this.resetScene();
    this.update();
    this.area.focus({ preventScroll: true });
  }
  private clear(): void {
    this.keys.clear();
    this.holds.clear();
    this.padDirection = 0;
    this.pad.dataset.direction = "idle";
    this.game.clearInputs();
    this.updateButtons();
  }
  private blur(): void {
    this.clear();
    if (this.game.mode === "duel") {
      this.game.pause();
      this.update();
    }
  }
  /** Esc: pause or resume the duel, or open and close the help on the title. */
  toggleMenu(): void {
    this.unlock();
    this.clear();
    if (this.game.mode === "title") this.help = !this.help;
    else if (this.game.mode === "duel" || this.game.mode === "paused")
      this.game.pause();
    this.update();
    if (this.overlay.hidden) this.area.focus({ preventScroll: true });
    else this.menu.focus();
  }
  private updateMovement(): void {
    const left =
      this.keys.has("KeyA") ||
      this.keys.has("ArrowLeft") ||
      this.padDirection < 0;
    const right =
      this.keys.has("KeyD") ||
      this.keys.has("ArrowRight") ||
      this.padDirection > 0;
    this.game.direction = Number(right) - Number(left);
    const direction =
      this.game.direction < 0
        ? "left"
        : this.game.direction > 0
        ? "right"
        : "idle";
    if (this.pad.dataset.direction !== direction)
      this.pad.dataset.direction = direction;
  }

  private slide(clientX: number): void {
    this.padDirection = padDirection(this.pad, clientX);
    this.updateMovement();
  }
  private keyDown(e: KeyboardEvent): void {
    // The open menu already used this key (Esc, arrows).
    if (e.defaultPrevented) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === "Tab" && !this.overlay.hidden) {
      const buttons = Array.from(
        this.overlay.querySelectorAll<HTMLElement>(
          "button:not([hidden]), input"
        )
      ).filter((node) => node.getClientRects().length > 0);
      const index = buttons.indexOf(document.activeElement as HTMLElement);
      buttons[
        (index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
      e.preventDefault();
      return;
    }
    const allowed = [
      "KeyA",
      "KeyD",
      "ArrowLeft",
      "ArrowRight",
      "KeyJ",
      "Space",
      "Enter",
      "Escape",
      "KeyM",
    ];
    if (!allowed.includes(e.code)) return;
    // Arrow keys move the sliders and switches of an open settings panel.
    if (
      this.menu.panel &&
      e.target instanceof HTMLInputElement &&
      e.code !== "KeyM"
    )
      return;
    if (
      (e.code === "Enter" || e.code === "Space") &&
      e.target instanceof HTMLButtonElement
    ) {
      const action = e.target.dataset.touch;
      if (action && this.game.mode === "duel") {
        e.preventDefault();
        if (!e.repeat) {
          if (action === "left" || action === "right") {
            if (this.holds.press("move", e.code, this.pad)) {
              this.padDirection = action === "left" ? -1 : 1;
              this.updateMovement();
            }
          } else if (action === "attack" || action === "evade")
            this.holds.press(action, e.code, e.target);
        }
      }
      return;
    }
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === "KeyM") {
      this.toggleSound();
      return;
    }
    if (e.code === "Escape") {
      this.toggleMenu();
      return;
    }
    if (this.help || this.game.mode === "paused") {
      if (e.code === "Enter") this.toggleMenu();
      return;
    }
    if (e.code === "Enter") {
      if (
        this.game.mode === "title" ||
        this.game.mode === "victory" ||
        this.game.mode === "defeat"
      )
        this.start();
      return;
    }
    if (e.code === "KeyJ" && this.game.mode === "title") this.start();
    if (this.game.mode !== "duel") return;
    this.keys.add(e.code);
    this.updateMovement();
    if (e.code === "Space") this.holds.press("evade", e.code, this.area);
    if (e.code === "KeyJ") this.holds.press("attack", e.code, this.area);
  }
  /** Where a press on the battlefield itself lands, in world units. */
  private aim({ node, event }: HoldDetail): Point | undefined {
    if (node !== this.area || !event) return undefined;
    const rect = this.area.getBoundingClientRect();
    return this.worldAt({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
  private begin(role: Role, detail: HoldDetail): void {
    this.unlock();
    if (role === "attack") this.game.press(this.aim(detail));
    else if (role === "evade") this.game.evade();
    else if (detail.event) this.slide(detail.event.clientX);
    this.updateButtons();
  }

  private finish(role: Role, cancelled: boolean, detail: HoldDetail): void {
    if (role === "move") {
      this.padDirection = 0;
      this.updateMovement();
    } else if (role === "attack") {
      if (cancelled) this.game.cancelCharge();
      else this.game.release(this.aim(detail));
    }
    this.updateButtons();
  }

  private updateButtons(): void {
    const held = this.game.mode === "duel" && this.game.hold;
    const percent = held
      ? Math.min(100, Math.round((this.game.charge / 0.75) * 100))
      : 0;
    if (this.strike.dataset.held !== String(held))
      this.strike.dataset.held = String(held);
    if (this.chargePercent !== percent) {
      this.chargePercent = percent;
      this.strike.style.setProperty("--charge", percent + "%");
    }
    const label = percent === 100 ? "已蓄滿" : held ? "放開出劍" : "按住蓄力";
    if (this.strikeHint.textContent !== label)
      this.strikeHint.textContent = label;
    const evading = String(this.holds.held("evade"));
    if (this.evadeButton.dataset.held !== evading)
      this.evadeButton.dataset.held = evading;
  }

  private menuItems(ended: boolean): MenuItem[] {
    const sound: MenuItem = {
      id: "sound",
      label: "音效設定",
      action: () => this.openSound(),
    };
    if (ended)
      return [
        {
          id: "again",
          label: "再戰一場",
          domId: "primary",
          action: () => this.start(),
        },
      ];
    if (this.game.mode === "paused")
      return [
        {
          id: "resume",
          label: "繼續決鬥",
          domId: "primary",
          action: () => this.toggleMenu(),
        },
        {
          id: "restart",
          label: "重新決鬥",
          domId: "restart",
          action: () => this.start(),
        },
        sound,
      ];
    return [
      {
        id: "back",
        label: "返回",
        domId: "primary",
        action: () => this.toggleMenu(),
      },
      sound,
    ];
  }

  update(): void {
    this.updateButtons();
    const game = this.game,
      values = [game.heroHp, Math.round(game.stamina), game.foeHp];
    for (let i = 0; i < 3; i++)
      if (values[i] !== this.meterValues[i]) {
        this.meters[i].style.setProperty("--fill", String(values[i] / 100));
        this.meters[i].setAttribute("aria-valuenow", String(values[i]));
        this.meterValues[i] = values[i];
      }
    const ended =
      (game.mode === "victory" || game.mode === "defeat") &&
      game.outcomeTime > 0.88;
    const state = [game.mode, this.help, ended].join("-");
    if (state === this.renderedState) return;
    this.renderedState = state;
    if (
      (game.mode === "victory" || game.mode === "defeat") &&
      this.stage.dataset.mode !== game.mode
    )
      this.clear();
    this.stage.dataset.mode = game.mode;
    this.overlay.hidden = !(this.help || game.mode === "paused" || ended);
    this.menu.setItems(this.menuItems(ended));
    // A hidden menu must not take Esc or the arrows away from the duel.
    this.menu.show(!this.overlay.hidden);
    this.title.textContent = ended
      ? game.mode === "victory"
        ? "決鬥勝利"
        : "決鬥落敗"
      : game.mode === "paused"
      ? "決鬥暫停"
      : "操作說明";
    element("bindings").hidden = ended;
    this.result.hidden = !ended;
    if (ended) {
      this.result.textContent =
        "命中 " +
        game.hits +
        " 次　／　用時 " +
        Math.max(1, Math.round(game.elapsed)) +
        " 秒";
      this.menu.focus();
    }
    element("announcement").textContent =
      game.mode === "duel"
        ? "決鬥開始"
        : this.overlay.hidden
        ? ""
        : this.title.textContent;
    const menu = element("menu");
    menu.setAttribute(
      "aria-label",
      game.mode === "duel" ? "暫停與操作說明" : "操作說明"
    );
    if (menu.firstElementChild)
      menu.firstElementChild.textContent = game.mode === "duel" ? "Ⅱ" : "?";
  }
}
