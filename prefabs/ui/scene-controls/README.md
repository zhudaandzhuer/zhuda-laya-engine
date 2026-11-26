# ui/scene-controls：3D 場景的介面層

浮島兩款遊戲右上角那一套，做成任何 3D 場景都能用的 DOM 介面：

- 左上標題：一行小字（亮綠點）、名稱（可有一段斜體）、下面一行。
- 右上：狀態列（數字粗體等寬）、天氣按鈕（選中的反白）、時間（時鐘、滑桿、暫停）、一個額外動作（例如「再丟一隻豬大」，可不要）、畫質（點一下換下一級）、聲音（開／靜音）。
- 下方提示（`say()` 換字，2.6 秒後變淡）、抓著東西時跟著指標的手（✊）、閃電的白光（`flash()`）。
- `embed: true`：嵌在別的網頁裡（官網首頁）只留畫質與聲音、提示變短放上方，手機寬度不顯示提示。

所有文字由遊戲傳入（已翻譯）；只用 `cp-sc-*` class，按鈕用 `ui/dom` 的 `press()`（觸控有別的手指按著也能按、鍵盤也能按）。

## 放進遊戲

```bash
node prefabs/scripts/sync.mjs games/<遊戲> ui/scene-controls
```

`index.html` 在遊戲自己的樣式前面加 `<link rel="stylesheet" href="common/ui/scene-controls/scene-controls.css">`（觀看台是 preset 動態加）。

```ts
import { createSceneControls } from './common/ui/scene-controls/scene-controls.ts';
import { WEATHERS, clockText } from './common/3d/day-look.ts';

const hud = createSceneControls(container, {
  title: { kicker: 'ZHUDA ENGINE · LIVE', name: 'Zhuda', em: 'Sky Island', sub: '豬大浮島' },
  weathers: Object.entries(WEATHERS).map(([id, label]) => ({ id, label })),
  weather: 'clear', hour: 9.5, clock: clockText,
  levels: ['低', '中', '高', '滿'], level: 1, soundOn: sound.on,
  hint: '按住豬大把牠抓起來・甩一甩・放手丟出去',
  labels: { time: '時間', run: '時間流動', drop: '再丟一隻豬大', quality: '畫質', qualityTip: '畫質：低／中／高／滿', soundOn: '🔊 聲音', soundOff: '🔇 靜音' },
  onWeather: (w) => (day.weather = w), onHour: (h) => (day.hour = h), onClockRuns: (r) => (day.clockRuns = r),
  onLevel: (i) => applyTier(i), onDrop: () => pig.respawn(), onSound: () => sound.toggle(),
});
hud.status([{ value: '60' }, ' FPS · 草 ', { value: '27,512' }, ' 根']);
hud.clock(day.hour);       // 每半秒
hud.flash(day.flash);      // 每幀
hud.hand([x, y], true);    // 抓著時；hud.hand(null, false) 收起
hud.say('抓到豬大了！');
hud.setSound(true);        // 頁面替玩家開關聲音時
```

`labels.drop: null` 就沒有額外動作的按鈕。

## 主題變數

`--cp-sc-text`、`--cp-sc-pill`（膠囊底色）、`--cp-sc-line`（膠囊邊）、`--cp-sc-on`／`--cp-sc-on-text`（選中的按鈕）、`--cp-sc-accent`（時間滑桿）、`--cp-sc-live`（亮點）、`--cp-sc-hint`、`--cp-sc-flash`、`--cp-sc-font`、`--cp-sc-title-font`。位置用遊戲自己的 CSS 覆寫 `.cp-sc-title`、`.cp-sc-panel`、`.cp-sc-hint`。預設值就是浮島的樣子。

## 驗證過的

- `tests/scene-controls.test.mjs`（假 DOM）：標題、天氣按鈕選中與回呼、滑桿與時鐘、暫停、額外動作、畫質循環、聲音切換與 `setSound`、鍵盤點擊、狀態列分段、提示、手、白光的上下限、embed 與沒有額外動作。
- 觀看台 `sky-island`、`home-island` 用它代替原遊戲的 `hud.ts`，和原遊戲的截圖逐像素比對相同（介面也在截圖裡）。

## 來源

`games/zhuda-sky-island/src/hud.ts` 與 `games/zhuda-home-island/src/hud.ts`（加了 `embed`、`setSound`），2026-11-16。class 由 `zsi-*` 改為 `cp-sc-*`、CSS 搬到 `scene-controls.css`（同樣的規則，顏色換成變數、預設值不變）、`<b>`／`<small>`／`<em>` 改成有 class 的 `<span>`、文字全部改由遊戲傳入、按鈕改用 `press()`。
