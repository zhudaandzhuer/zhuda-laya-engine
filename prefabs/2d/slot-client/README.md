# 2d/slot-client：老虎機用戶端的其餘部分

回合狀態機、本機帳本、自動前進在 `systems/slot-round`（和 dungeon-spin 共用）；這裡是 slot 用戶端其他不碰引擎的東西：

| 檔案 | 內容 |
|---|---|
| `protocol.ts` | 連消回合的畫面資料：`CascadePlay`（一轉：初始盤面、每一波 `TumbleFrame`、最後盤面與倍數、baseWin × multiplier、分散、封頂、免費遊戲累積倍數）、`CascadeRoundPayload`／`CascadeBonusPayload`（給 `LocalSession` 的 p／b）、`CascadeSnapshot`、`CurrencyMode` |
| `server-round.ts` | 伺服器（`server/slotmath`）回傳的回合 JSON 型別、`toCascadePlay()`、`toResolvedRound()`：主遊戲 `p.mainWin` ＋ 免費遊戲 `b.total` ＝ `totalWin` |
| `remote-session.ts` | `RemoteSession`：實作 `systems/slot-round` 的 `SessionPort`，`accept()` 改成請伺服器開局（伺服器扣注、派彩），回合留著給重播；選擇的 fixture 是 `'buy'` 就購買、`'ante'` 就 ante。同一個 `GameRuntime`、按鈕、演出播放器直接跑伺服器權威的遊戲 |
| `vendor.ts` | `RemoteSlotClient`：`health()`、`balance()`、`spin({ betAmount, anteBet, buyFeature })`、`replay(id)`，對 `server/slotgateway`；Bearer token；錯誤帶 HTTP 狀態（402 餘額不足、429 還在轉） |
| `pipeline.ts` | `PipelineExecutor`：具名插件的洋蔥管線（`execute`、只在插件不等別的東西時才可用的 `executeSync`） |
| `event-bus.ts` | `EventBus<事件表>`：依序 await 處理器、`on` 傳回取消 |
| `slot-store.ts` | `SlotStore`：餘額、注額、幣別（符號可設定；SWEEPS 幣自動切到 SWEEPS_US 法規）、語系，變動走 bus |
| `locale-pipeline.ts` | `LocalePipeline`：營運商語系碼正規化（zh_CHS→zh-CN、tw／hk→zh-TW…）→ 核心字典 → 遊戲字典 → 法規與幣別覆寫 → 排版（德文縮到 0.62、泰文行高 1.35、阿拉伯文 rtl）；`t(key, {參數})` |
| `asset-resolver.ts` | `AssetResolver`：邏輯鍵 → 路徑，依序找營運商皮膚＋語系 → 遊戲語系 → 遊戲預設 → 核心備援，並回報是哪一層 |

拆自 <original-cascade-slot>（主題與美術未收）：`client/src/core/`（contracts、pipeline、store）與 `plugs/`（i18n、assets、vendors）。改了：事件表、字典、覆寫、皮膚表、幣別符號都變成參數（原本寫死它自己的文字與一個全域 store）；資產尋址原本只宣告了四層、實際只查一張表，這裡四層是真的；伺服器回合的對應配合共用的 Go 伺服器重寫（原本的 `mapRsgToPresentation` 依它自己的欄位與主題動作名）。DOM 頁面用「原文當鍵」的翻譯請用 `systems/i18n`，這裡的是 slot 用的鍵值字典。

## 用法

```ts
import { RemoteSlotClient } from './common/2d/slot-client/vendor.ts';
import { toResolvedRound } from './common/2d/slot-client/server-round.ts';
import { LocalePipeline } from './common/2d/slot-client/locale-pipeline.ts';
import { SlotStore } from './common/2d/slot-client/slot-store.ts';

const client = new RemoteSlotClient({ baseUrl: 'http://127.0.0.1:8088', token: () => sessionStorage.getItem('slot-token') ?? undefined });
const { round, balance } = await client.spin({ betAmount: 10 });
const { p, b } = toResolvedRound(round, 6, 5); // p.spin、b.spins 交給 2d/slot-ui 的 CascadeStepPlayer

const store = new SlotStore({ balance });
const i18n = new LocalePipeline({
  core: { 'en-US': { spin: 'SPIN', free: 'FREE SPINS' }, 'zh-TW': { spin: '旋轉', free: '免費遊戲' } },
  overrides: [{ when: (c) => c.jurisdiction === 'UKGC', texts: { free: 'BONUS SPINS' } }],
  gameParams: { maxWin: 5000 },
});
await i18n.switchLocale('tw', { jurisdiction: store.jurisdiction });
console.log(i18n.t('spin'), p.mainWin + b.total === round.totalWin);
```

（2026-11-25 對引擎 def94aa 型別檢查過。）

## 驗證（2026-11-25）

`tests/slot-client.test.mjs`：`RemoteSession` 接 `GameRuntime`（一般、購買、ante、重播、已演出標記）；管線洋蔥順序與 `next()` 兩次報錯；bus 順序與取消；store 的 SWEEPS 法規；語系（原遊戲門禁 12 的四項：zh_CHS→zh-CN、德文 0.62、阿拉伯文 rtl、參數代入，加上法規覆寫與退回預設語系）；資產四層；200 個種子 × 一般／購買的伺服器回合轉換（金額相加、波數、每波 ≥ 8 格、免費局數與倍數）；遠端用戶端（假 fetch：health、balance、spin、replay、402 錯誤、連不上）。

## 已知限制

- 對真伺服器只在本機跑過一次（2026-11-25：`cmd/slotserver` 開發模式＋`RemoteSlotClient`＋`RemoteSession`＋`GameRuntime`＋`CascadeStepPlayer`（假畫面）連跑 30 局含 3 次購買，用戶端餘額＝伺服器餘額＝起始 − 下注 ＋ 贏分，每局向伺服器要重播轉出來的金額相同）；沒有在瀏覽器、跨網域、斷線重試下跑過。
- `RemoteSession` 不處理「請求送出後斷線」：伺服器可能已扣注開局，用戶端不知道；要用回合 id 查詢補回（`replay`）是遊戲的事。原遊戲的作法是繞過狀態機直接演，沒收。
- 語系與資產表都要遊戲自己給；這裡沒有任何遊戲文字或圖片路徑。
