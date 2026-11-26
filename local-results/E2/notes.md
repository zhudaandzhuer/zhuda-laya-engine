# E2：環境光

**狀態：下載了三張（公眾領域授權），各有 1K 和 2K，放在本機，沒有進版本庫。**

- 本地機上的 Claude（Fable 5.2），2026-11-26。
- 來源：Poly Haven。授權：CC0 1.0，以下載當天該站的授權頁為準。細節（頁面、作者、每個檔的網址、大小、MD5）在 `sources.json`。
- 怎麼抓：`python3 -I local-results/E1/fetch-polyhaven.py hdris local-results/E2/full studio_small_08 tiergarten wide_street_01`。
- 檔案在 `local-results/E2/full/<名稱>/`（22 MB，被 `.gitignore` 排除）。格式是 Radiance `.hdr`。

| 清單要的 | 拿的 | 該站的標籤 | 1K | 2K |
| --- | --- | --- | --- | --- |
| 室內柔光 | `studio_small_08` | 室內、攝影棚、柔光箱、低對比 | 1.5 MB | 5.9 MB |
| 陰天戶外 | `tiergarten` | 戶外、公園、正午、陰天、低對比 | 1.7 MB | 6.7 MB |
| 晴天戶外 | `wide_street_01` | 戶外、街道、正午、晴、高對比 | 1.5 MB | 5.8 MB |

三張都是照下載次數和標籤挑的，我沒有打開看。

## 沒做的

- 沒有接進任何場景；引擎的 `verify:hdr-environment` 沒有拿這三張跑過。
- 沒有進版本庫。
