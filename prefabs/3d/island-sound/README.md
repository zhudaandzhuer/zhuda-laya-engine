# 3d/island-sound：島的聲音（環境音、效果音、豬大與豬二的台詞、歌）

浮島兩款遊戲的全部聲音，走引擎的 `IframeSoundAdapter`：

- 環境音（依時間與天氣淡入淡出，有遲滯不會一直切換）：白天微風＋鳥叫＋樹葉、夜晚蟲鳴＋青蛙、雨、暴雨、高空風、強風；長的用串流播放（不整個解碼），風車的木頭吱嘎聲放在風車上（3D）。
- 效果音（放在發生的位置）：打雷三種（閃電後依距離延遲）、落地輕重、屋頂、大小水花、划水、咻（丟出去）、滑哨（從天上掉下來）、雲團、閃光、頭暈星星、愛心、草地腳步（兩種輪流）、濕腳步、甩水、抓起來的布料聲、介面點擊。
- 台詞：豬大 37 句（聲線「豬大_正式選定_C慵懶吐槽」）、豬二 24 句（「豬二-妹妹_甜美少女」），17 種情境（被抓、被甩、垂著放棄、被丟、落地、頭暈、掉池塘、甩水、屋頂、掉雲海、回來、歡呼、閒聊、下雨、雷雨、晚上、起霧）。放在角色頭的位置；一次只說一句（1.8 秒內別人不插話，`force` 例外）；同一種不連續說同一句。
- 歌：《ふたりの帰り道》（使用者自己的原創歌曲，444 秒，7 MB），最後才載、或一叫唱就載；`songTime()` 讀歌曲本身的播放時間（`<audio>` 的 currentTime），角色照它對拍（73 BPM）；唱歌時其他環境音只留風。
- 第一次點畫面或按鍵才出聲（瀏覽器規定）；`wake()` 給頁面在自己的點擊裡叫醒。靜音會記在 `storageKey`。
- 慢網路：環境音先串流、短音一次 4 個、先載抓起來會聽到的、失敗就一直重試（間隔 2 秒倍增到 30 秒）。

## 放進遊戲

```bash
node prefabs/scripts/sync.mjs games/<遊戲> 3d/island-sound
```

檔案在 `public/common/3d/island-sound/assets/{audio,voice/zhuda,voice/zhuer}/`（約 10.6 MB，其中歌 7 MB）。

```ts
import { DirectoryAssetProvider } from 'zhuda-laya-engine';
import { createIslandSound, SONG_FUTARI } from './common/3d/island-sound/island-sound.ts';

const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 240_000 });
const sound = createIslandSound({ provider, voices: ['zhuda', 'zhuer'], song: SONG_FUTARI, storageKey: 'my-game.sound' });
// 事件裡：
sound.effect('thump', at, 0.8);
sound.say('zhuer', 'grab', head, true);
// 每幀：耳朵的位置與朝向、現在的島聽起來怎樣、風車在哪
sound.update(eye, forward, { day: 1 - sky.night, night: sky.night, rain, storm, wind: sky.wind }, island.windmill);
// 唱歌：sound.sing() → true 表示開始了；sound.songTime() 秒數或 null；sound.stopSong()
```

- `voices`：載哪幾位的台詞（浮島遊戲只有 `['zhuda']`，官網版兩位）。`song`：不給就沒有歌。
- `lines.ts`（沒有引擎）：`LINES`（每種情境幾句）、`LINE_KINDS`、`EFFECTS`、`STREAMS`、`SONG_FUTARI`、`soundFiles(voices, song)`（會用到的全部檔案；測試拿它對 `assets/`）。
- `state()`：`{ on, unlocked, loaded, song, loops, diagnostics }`，給檢查用。

## 驗證過的

- `tests/sky-island.test.mjs` 最後一項：`assets/` 裡每個檔案都會被用到、會用到的每個檔案都在（91 個 m4a）；豬大 37 句、豬二 24 句，每種情境豬二都至少一句。
- 觀看台 `sky-island` 跑原遊戲的 `sound.json`（點一下、抓、甩、丟、雷雨、晚上）：解鎖、載入、播放事件，沒有錯誤（數字見交接報告）。`home-island` 的歌在一般（非虛擬時鐘）的 `home.json` 裡載入並開始播放。
- 原遊戲紀錄（2026-11-16）：線上點一下後 66 個聲音約 25 秒內載完；模擬 2.5 MB/s 首訪約 10 秒；模擬斷線 40 秒，恢復後 45 秒內補齊。

## 沒驗證／限制

- **沒人耳聽過**語氣與音量平衡；手機上沒試過解鎖與播放。
- 豬大有一句只差同音字（「摔得／摔的」），其餘 36 句語音辨識核對通過；豬二 24 句都通過（「暈」一直被念錯，改了三句的說法，見 `source/voice/`）。
- 歌的第一拍位置沒量（`offset: 0`）。

## 素材怎麼來的（`source/`，不會複製進遊戲）

- `source/sfx.py`：環境音與效果音全部用 numpy 合成（沒有錄音），同一個 seed 同結果；循環音把尾巴交叉淡入開頭做成無縫。需要 numpy、scipy、ffmpeg：
  ```bash
  cd prefabs/3d/island-sound
  python3 source/sfx.py          # 寫 assets/audio/*.m4a（AAC 112k，打雷 128k）；.wav 母帶放 $SFX_WORK 或暫存資料夾
  ```
  不會產生 `song-futari.m4a`（那是使用者的歌，原始檔不在這裡）。
- `source/voice/zhuda-lines.json`（37 句，含 `emotion`：panic、happy、neutral）、`zhuer-lines.json`（24 句的定稿）、`zhuer-redo*.json`（重念過的幾句，定稿已併入 `zhuer-lines.json`）。用 `zhuda-voice` 技能：
  ```bash
  voice script source/voice/zhuda-lines.json --out-dir <暫存>/zhuda --check
  ```
  `source/voice/zhuda-emotions/*.json`：當時為豬大設計 `panic`、`happy` 兩種情緒參考的設定（`voice design`，`similar` 判定同一人才存進聲線庫；聲線庫在工作站的 voices 資料夾）。
- 台詞轉檔（原遊戲 HANDOFF 的紀錄）：`ffmpeg -i X.wav -af "silenceremove…,loudnorm=I=-15:TP=-1.5" -ac 1 -c:a aac -b:a 96k voice/<who>/X.m4a`。`silenceremove` 的參數當時沒記下來；現在的檔案是單聲道 AAC、44.1 kHz、約 96 kbps。重做時可用 `silenceremove=start_periods=1:start_threshold=-45dB`（只去掉開頭的靜音）再 `loudnorm`，做完要用耳朵和舊檔比一下。
- 檔名規則：`voice/<who>/<情境>-<第幾句>.m4a`，句數要和 `lines.ts` 的 `LINES` 一致（測試會檢查）。

## 來源

`games/zhuda-sky-island/src/sound.ts`（豬大一位）與 `games/zhuda-home-island/src/sound.ts`（兩位＋歌，超集合），2026-11-16；聲音檔兩款逐位元組相同（浮島的 `voice/*.m4a` ＝ 官網版的 `voice/zhuda/*.m4a`）。收進來時把「誰的台詞、有沒有歌、記靜音的 key、檔案的位置」變成選項。
