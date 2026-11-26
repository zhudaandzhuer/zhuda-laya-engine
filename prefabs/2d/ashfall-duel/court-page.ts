/**
 * The page of 「灰燼之庭」: the exact markup of the original game's <main id="theatre"> (status
 * meters, sound and menu buttons, title lockup with the 豬大 × LayaAir co-brand mark, start
 * button, warden meter, keyboard hints, two-thumb touch controls, the menu overlay, the
 * loading line), and the style sheets it needs in their order. interface.ts finds these
 * nodes by id; court.css lays them out. A game can paste the markup into its index.html
 * instead (keep the whitespace: inline elements are laid out from it).
 */

/** Where the co-brand mark is served after sync (it is the engine's assets/branding/zhuda-layaair-mark.svg). */
export const COURT_MARK = "./common/2d/ashfall-duel/assets/branding/zhuda-layaair-mark.svg";

/** The style sheets, in order: the menu and the settings form first, so court.css can override them. */
export const COURT_STYLES = [
  "./common/ui/game-menu/game-menu.css",
  "./common/ui/settings-form/settings-form.css",
  "./common/2d/ashfall-duel/court.css",
] as const;

/** The markup of <main id="theatre">, byte for byte the original's except the mark's address. */
export function courtMarkup(markUrl: string = COURT_MARK): string {
  return `<main id="theatre" data-mode="loading">
      <div id="game" aria-label="灰燼之庭決鬥場" tabindex="-1"></div>
      <div id="interface">
        <header id="status">
          <div class="crest" aria-hidden="true"><i></i></div>
          <div class="vitals" aria-label="流浪騎士狀態">
            <span class="fighter-name">流浪騎士</span>
            <div
              class="meter health"
              id="hp"
              role="progressbar"
              aria-label="生命"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="100"
            >
              <i></i>
            </div>
            <div
              class="meter stamina"
              id="stamina"
              role="progressbar"
              aria-label="體力"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="100"
            >
              <i></i>
            </div>
          </div>
        </header>
        <nav class="tools" aria-label="遊戲選單">
          <button id="sound" class="tool" aria-label="關閉音效" title="音效 M">
            <span class="sound-icon" aria-hidden="true">◖</span>
          </button>
          <button
            id="menu"
            class="tool"
            aria-label="操作說明"
            title="操作說明 Esc"
          >
            <span aria-hidden="true">?</span>
          </button>
        </nav>
        <div class="entry">
          <div class="title-lockup">
            <span aria-hidden="true" class="finial"></span>
            <h1>灰燼之庭</h1>
            <img
              class="engine-mark"
              src="${markUrl}"
              alt="豬大 × LayaAir 引擎"
              width="960"
              height="300"
            />
          </div>
          <button id="start" class="iron-button">
            <span>開始決鬥</span><kbd>Enter</kbd>
          </button>
        </div>
        <div class="foe-status" id="enemy-status">
          <div class="foe-name"><span></span>城門守衛<span></span></div>
          <div
            class="meter enemy-health"
            id="foe-hp"
            role="progressbar"
            aria-label="城門守衛生命"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="100"
          >
            <i></i>
          </div>
        </div>
        <div class="shortcuts" aria-hidden="true">
          <span><kbd>A</kbd><kbd>D</kbd> 移動</span
          ><span><kbd>J</kbd> 揮擊／按住蓄力</span
          ><span><kbd>Space</kbd> 後撤</span>
        </div>
        <div class="touch-buttons" role="group" aria-label="觸控操作">
          <div class="move-control">
            <div id="stride-pad" role="group" aria-label="左右移動">
              <button type="button" data-touch="left" aria-label="向左移動">
                <i aria-hidden="true"></i>
              </button>
              <button type="button" data-touch="right" aria-label="向右移動">
                <i aria-hidden="true"></i>
              </button>
              <span class="pad-grip" aria-hidden="true"></span>
            </div>
            <span class="pad-caption" aria-hidden="true">移動</span>
          </div>
          <div class="action-buttons">
            <button
              type="button"
              class="evade-button"
              data-touch="evade"
              aria-label="閃避，向後撤步"
            >
              <i aria-hidden="true"></i><span>閃避</span>
            </button>
            <button
              type="button"
              id="strike-button"
              class="strike-button"
              data-touch="attack"
              aria-label="攻擊，按住蓄力、放開出劍"
            >
              <i aria-hidden="true"></i><span>攻擊</span><small>按住蓄力</small>
            </button>
          </div>
        </div>
        <div id="overlay" hidden>
          <section
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <span class="finial" aria-hidden="true"></span>
            <h2 id="dialog-title">操作說明</h2>
            <div id="bindings">
              <dl class="key-bindings">
                <div>
                  <dt>
                    <kbd>A</kbd> <kbd>D</kbd> ／ <kbd>←</kbd> <kbd>→</kbd>
                  </dt>
                  <dd>前進與後退</dd>
                </div>
                <div>
                  <dt><kbd>J</kbd> ／ 點擊對手</dt>
                  <dd>放開揮擊，按住蓄力</dd>
                </div>
                <div>
                  <dt><kbd>Space</kbd></dt>
                  <dd>向後閃避</dd>
                </div>
              </dl>
              <dl class="touch-bindings">
                <div>
                  <dt>移動鍵</dt>
                  <dd>按住移動，滑過中央換向</dd>
                </div>
                <div>
                  <dt>攻擊鍵</dt>
                  <dd>輕點快斬，長按蓄力後放開</dd>
                </div>
                <div>
                  <dt>閃避</dt>
                  <dd>向後撤步，可接在揮擊之後</dd>
                </div>
              </dl>
            </div>
            <p id="result-line" hidden></p>
            <div id="dialog-menu"></div>
          </section>
        </div>
        <div id="load-status" role="status">正在進入城門…</div>
        <div id="announcement" class="sr-only" aria-live="polite"></div>
      </div>
    </main>`;
}

/**
 * Builds the page: links the style sheets (waits until they are applied) and puts
 * <main id="theatre"> in place of `replace` (or at the end of <body>). Returns the #game
 * element, the container to boot the engine in.
 */
export async function mountCourtPage(
  options: { replace?: Element; markUrl?: string; styles?: readonly string[] } = {}
): Promise<HTMLElement> {
  const links = (options.styles ?? COURT_STYLES).map((href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    const loaded = new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(Error("樣式表載入失敗 " + href));
    });
    document.head.append(link);
    return loaded;
  });
  await Promise.all(links);
  const holder = document.createElement("div");
  holder.innerHTML = courtMarkup(options.markUrl);
  const theatre = holder.firstElementChild as HTMLElement;
  if (options.replace) options.replace.replaceWith(theatre);
  else document.body.append(theatre);
  return theatre.querySelector<HTMLElement>("#game")!;
}
