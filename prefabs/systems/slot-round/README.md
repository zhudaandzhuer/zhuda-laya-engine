# systems/slot-round：拉霸類遊戲的回合狀態機與本機帳本

一顆大按鈕的回合遊戲（拉霸、轉輪、抽獎、「前進一步」）都一樣的那一層，不碰引擎、不碰畫面，node 就能跑與測：

- **一顆按鈕做對的事**：`state.primary` 是 `advance`（開一局）、`accelerate`（演出中：加速）、`collect-next`（大獎或預覽中：收下並接下一局）、`stop`（自動中：停止）、`wait`；`runtime.advance()` 照它做。
- **先記帳再演出**：`LocalSession` 先把這一局（下注、贏分、之後的點數）寫進 localStorage，才交給畫面演；演出失敗也不會撤銷這一局（改叫 `recover()`）；重新整理會重播最後一局。每次讀取都把整份存檔重新核對一遍（序號、id、每一局的下注與贏分照規則重算、每一步的餘額），對不上就拒絕、不覆寫；寫不進去（容量滿）點數不變。
- **自動前進**：1–999 局、局間停 450 ms、每局核對（新的 id、安全的非負整數）、`stopAuto()` 演完這局就停、演出出錯也停。
- **事件流**：`subscribe((event) => …)`，每個事件帶完整的唯讀 `state`；`diagnostics` 留最近 400 筆。

拆自 `games/dungeon-spin`（`src/domain/dungeon-slot/core/`）。改了的只有：下注額、第一局的選擇、存檔鍵、鎖名、規則 id、起始點數、保留局數變成選項
（原本寫死 10／20／50、`multi`、`dungeon-spin.local-session.v1`、`original-fixed-v1`、100000、100）。

| 檔案 | 內容 |
|---|---|
| `game-runtime.ts` | `GameRuntime`：`attachSession`、`advance`、`play`、`replay`、`collect`、`configure`、`startAuto`、`stopAuto`、`subscribe`、`state` |
| `local-session.ts` | `LocalSession`：`open`、`accept(fixture, bet, { burst })`、`replay`、`markPresented`、`refresh`、`reset`、`points`、`last` |
| `auto-advance.ts` | `AutoAdvance`（`GameRuntime` 內建一個） |
| `round-runner.ts` | `runRound`：接受→`accepted`→`play`→`complete`→標記已演出；任何一步失敗→`recover` |
| `contracts.ts` | `Selection`、`RoundView`、`PresentationPort`、`SessionPort`、`RuntimeState`、`primaryAction()` |
| `diagnostics.ts` | `Diagnostics`：有上限的事件紀錄，`export()` 給除錯 |

## 用法

```ts
import { GameRuntime } from './common/systems/slot-round/game-runtime.ts';
import { LocalSession } from './common/systems/slot-round/local-session.ts';

const session = new LocalSession({
  storage: localStorage,
  resolve: (fixture, singleBet) => myRules(fixture, singleBet),   // 傳回 { p: { totalBet, mainWin, … }, b: { total, … } }
  saveKey: 'my-slot.local-session.v1', rules: 'my-rules-v1', bets: [10, 20, 50], initialPoints: 100000,
});
await session.open();

const runtime = new GameRuntime({
  presentation: {
    play: async (round, ctx) => { ctx.phase('spinning'); /* 演這一局；round.p、round.b、round.win */ },
    accelerate: () => { /* 加快 */ },
    collect: () => { /* 提早收下 */ },
  },
  bets: [10, 20, 50],
  initial: { fixture: 'default', singleBet: 10, mode: 'normal' },
});
runtime.attachSession(session);
runtime.subscribe(({ state }) => { button.label = state.primary; balance.text = String(state.points); });
button.onclick = () => runtime.advance();
```

完整的接法（畫面、按鈕、彈窗、自動設定）在 `2d/dungeon-spin/dungeon-spin.ts`。
`resolve` 要對同一個 `(fixture, bet)` 永遠傳回同樣的 `p.totalBet`、`p.mainWin`、`b.total`：帳本靠它重算核對每一局。

## 驗證

- `tests/slot-round.test.mjs`（9 項）：按鈕狀態表；先記帳再演出、加速、收下接下一局；演出丟錯不撤銷；自動前進 3 局與中途停止、拒絕 1000 局；重複 id 停止；竄改的存檔（點數、贏分、壞 JSON、別的規則）被拒；寫入失敗點數不變、只留最後 `limit` 局；選項；重載重播最後一局。
- 和原遊戲的 `GameRuntime`／`LocalSession` 跑同一段腳本（23 個動作＋120 局進帳），事件、狀態、存檔逐位元組相同（2026-11-25，見 `2d/dungeon-spin/README.md`）。

## 限制

- `timer` 選項要**之後**才呼叫回來（像 `setTimeout`）；同步呼叫會讀到還沒初始化的計時器 id 而停掉自動（原碼就是這樣，測試裡用 `setImmediate`）。
- 帳本只在一個瀏覽器裡：`lock` 預設不鎖（多分頁可傳 `navigator.locks.request` 進來）；「另一個分頁已重設」靠每局比對 `generation` 發現。
- 試玩點數，不是錢：沒有伺服器、沒有簽章。要伺服器做權威時，寫一個實作 `SessionPort` 的物件（`accept`、`replay`、`refresh`、`markPresented`、`points`、`last`、`state.generation`）接到同一個 `GameRuntime`；Go 端的例子是 `server/dungeonauthority`（沒有接過）。
- `GameRuntime` 用 `setTimeout` 排自動的間隔，不是引擎的分層時鐘。

## 從 <original-cascade-slot> 併入的選項（2026-11-25）

`<original-cascade-slot>` 的 `core/runtime/`（GameRuntime、LocalSession、AutoAdvance、RoundRunner、Diagnostics）和 dungeon-spin 是同一份程式：
AutoAdvance、RoundRunner 只差註解，LocalSession 只差存檔鍵和每一局多存一個 `contractVersion: 1`，
GameRuntime 多一個正式狀態機（`fsmState`），Diagnostics 多一個 `tail()`。所以沒有另做一份，而是把差異變成選項，**不給選項時一切照舊**：

| 選項 | 做什麼 |
|---|---|
| `GameRuntime({ fsm: true })` | 正式狀態機：`IDLE → BET_COMMITTED → REVEALING → RESOLVING → BONUS → CELEBRATING → IDLE`，重播走 `REPLAYING`。`ctx.phase('walking'|'revealing'|'resolving'|'bonus'|'celebration'|'idle')` 推動它；非預期的轉換記一筆 `fsm.warning`（不擋）。`state.fsmState`、每筆診斷都帶它 |
| `GameRuntime({ beforeRound })` | 每一局開始前（手動和自動都會）呼叫，傳回的 patch 改這一局的選擇；用來給每一局新的種子。原本自動前進只能一直重播同一個 fixture |
| `new GameRuntime<R>()`、`PresentationPort<R>`、`RoundView<P, B>` | 型別參數：別的回合資料（例如連消的 `CascadeSnapshot`，在 `2d/slot-client`）也能有型別；預設是 dungeon-spin 的 |
| `LocalSession({ contractVersion: true })` | 每一局存檔和重播多一個 `contractVersion: 1`（gates 原本的存檔格式） |
| `Diagnostics.tail(n)` | 最近 n 筆 |

驗證（2026-11-25，拆 gates 的工作區）：
- 不給這些選項：用 dungeon 工作區的同一支腳本（`runs/coreeq/run.mjs`：23 個動作＋120 局進帳）跑，事件、狀態、存檔、診斷和 dungeon-spin 原碼的輸出逐位元組相同（96,623 位元組）；`tests/slot-round.test.mjs` 9 項全過。
- 給 `fsm`、`contractVersion` 和 gates 的存檔鍵、規則 id：同一支腳本對 gates 原本的 `GameRuntime`／`LocalSession`（引擎改釘 def94aa 的副本）逐位元組相同（103,576 位元組，含 212 次 `fsmState`、100 次 `contractVersion`）。
- `tests/slot-round-options.test.mjs`：狀態機的轉換與警告、`beforeRound` 在手動與自動都會換種子、`contractVersion` 存檔、型別參數。
