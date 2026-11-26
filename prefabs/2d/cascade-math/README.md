# 2d/cascade-math：隨處消除連消老虎機的數學（TypeScript）

不碰引擎、不碰畫面，node 就能跑。兩套東西：

- **`CascadeEngine`（`engine.ts`）**：和 Go 權威伺服器 `server/slotmath` **同一個演算法、同一個抽籤順序、同一份 JSON**：切盤面 → 任何位置同符號 `minMatch` 個以上依級距派彩 → 消除、掉落、從補充輪帶補 → 重複；倍數主遊戲加總、免費遊戲累加；分散派彩與觸發；封頂。同一個 `Mulberry32` 種子，用戶端和伺服器算出同一局。用在：不連伺服器的試玩（`LocalSession`）、展示、重播伺服器的一局。
- **腳本局管線（`fixture-pipeline.ts`）**：固定盤面（或種子隨機盤面）經過 reel → scatter-pays → tumble（每個獎項一波、固定補位）→ 倍數加總 → 封頂的插拔管線，加上「目標配對」獎勵列。用在：展示固定的大獎、吸客模式、介面的確定性測試。

拆自 <original-cascade-slot>（主題與美術未收）：引擎是 `server/internal/engine` 的 TypeScript 版；腳本局管線是 `client/src/plugs/math/（數學管線）`，原遊戲的常數全部變成 `FixtureMathConfig`。原遊戲的符號、賠率、輪帶、腳本局、獎勵表**沒有**收；這裡的 `exampleConfig()`、`exampleFixtureConfig()` 是自己編的中性設定。

| 檔案 | 內容 |
|---|---|
| `config.ts` | `CascadeConfig`（欄位與 Go 的 `slotmath.Config` 相同，JSON 名稱）、`pay`、`scatterPay`、`cost`、`validateConfig` |
| `engine.ts` | `CascadeEngine`：`spin(req, id)`、`cascade`、`freeSpins`、`slice`、`tumble`、`draw`；`evaluate(cfg, grid, bet)`、`orbList` |
| `rng.ts` | `Mulberry32`（`next()`、`intN(n)`，和 Go 相同）、`createSeededRng`（原用戶端的產生器，修好 32 位元回繞）、`buildStrip(counts, seed)`（和 Go `BuildStrip` 相同） |
| `seed-resolver.ts` | `createSeedResolver(cfg)`：`'seed:<n>'`、`'seed:<n>:buy'`、`'seed:<n>:ante'` → 一局的 `{ p, b }`（給 `LocalSession`）；`seedKey`、`parseSeedKey` |
| `example-config.ts` | 中性範例：6×5、八種形狀 8／11／14 個三級、金環分散（4 個起 12 次免費遊戲）、倍數球 ×2–×100、封頂 5000×；量到的 RTP 約 93%（見 `server/slotmath/README.md`） |
| `fixture-pipeline.ts` | `FixtureMathConfig`、五個插件工廠、`createFixturePipeline`、`fixtureContext`、`resolveFixture`、`targetMatchBonus`、`applyColumnGravity`、`defaultCue`（結果強度：feature／epic／multi／large／medium／small／none） |
| `example-fixtures.ts` | 中性腳本局：`empty`、`small`、`double`（兩波＋×5）、`feature`（4 個分散＋三列獎勵） |

## 用法

```bash
node prefabs/scripts/sync.mjs games/<遊戲>/client 2d/cascade-math   # 2d/slot-client、systems/slot-round 會一起來
```

```ts
import { CascadeEngine } from './common/2d/cascade-math/engine.ts';
import { Mulberry32 } from './common/2d/cascade-math/rng.ts';
import { exampleConfig } from './common/2d/cascade-math/example-config.ts';
import { createSeedResolver, seedKey } from './common/2d/cascade-math/seed-resolver.ts';
import { resolveFixture } from './common/2d/cascade-math/fixture-pipeline.ts';
import { exampleFixtureConfig } from './common/2d/cascade-math/example-fixtures.ts';
import { LocalSession } from './common/systems/slot-round/local-session.ts';

const cfg = exampleConfig(); // 遊戲換成自己的 CascadeConfig（和伺服器同一份數字）
const round = new CascadeEngine(cfg, new Mulberry32(168)).spin({ betAmount: 10 }, 'r1');
console.log(round.totalWin); // 204：4 波連消、51 × 4

const session = new LocalSession({ storage: localStorage, resolve: createSeedResolver(cfg), saveKey: 'my-slot.v1', rules: 'my-slot-v1', bets: [10, 20, 50, 100] });
await session.open();
const saved = await session.accept(seedKey(168), 10); // saved.p.spin 是給畫面的 CascadePlay

const scripted = resolveFixture(exampleFixtureConfig(), 'double', 10); // 固定的兩波＋×5
console.log(saved.win, scripted.p.mainWin);
```

（這段 2026-11-25 對引擎 def94aa 型別檢查過。）整個遊戲的接法在 `viewer2d/src/presets/cascade-slot.ts`。

## 驗證（2026-11-25）

- **TypeScript 引擎＝Go 伺服器**：`tests/cascade-math.test.mjs` 對 `server/slotmath/testdata/parity.json`：範例設定 30 個種子 × 3 種請求（一般、ante、購買）的每一局 SHA-256 相同（90 局，含購買的整段免費遊戲）。
- **腳本局管線＝原遊戲的數學**：在工作區把原遊戲自己的 TypeScript 數學和本模組（餵原遊戲的表）跑同樣的輸入：10 個腳本局＋一個不存在的鍵 × 3 種注額 × 2,000 個種子＝ 66,000 局、20,000 局種子隨機盤面、40,000 組獎勵列；284,328 步、76,459 個掉落畫面、76,459 個獎項、24,000 個獎勵拍、42,000 局有倍數、6,000 局封頂，每個欄位都相同（結果強度的名稱換成中性的，一對一對應）；非法注額兩邊都拒絕。
- 其他測試：級距與價格、`Mulberry32` 對 Go 的值、種子局重算、`LocalSession` 重開時重算每一局並拒絕被改過的存檔（`tests/cascade-math.test.mjs`）；原遊戲存檔門禁（先記帳再演出、容量滿、重開、並行、壞檔、餘額不足、100 局流水對帳）搬到種子局上（`tests/cascade-slot-session.test.mjs`）。

## 已知限制

- 原用戶端本機模式**沒有隨機局**：它照 14 個腳本局輪播（`Main.ts` 的 rotation），隨機盤面只在數學管線裡、從來沒有接上畫面。要真的隨機試玩，用這裡的種子局（`CascadeEngine`），不要用腳本局管線。
- 腳本局管線的「掉落」不是真的連消：每個獎項一波、補進來的是固定序列、補完不再判獎（原遊戲就是這樣，為了演出好控制）。
- 原遊戲另有 `MathEngine.present()`（只給它的門禁腳本用），30 格盤面的級距和管線不一致（9 個同符號在那裡算第二級），沒有收。
- `Mulberry32` 不是密碼學亂數：本機試玩點數可以，真錢一定要伺服器的 `CryptoRNG`。
