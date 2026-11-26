# D1：Blender 可以無頭執行

**做了。** 2026-11-25，本地機上的 Claude（Fable 5.2）。

| | |
| --- | --- |
| 版本 | Blender 5.2.2 LTS（hash `d13f752e3b9c`，2026-09-15 建置） |
| 執行檔 | `/opt/homebrew/bin/blender`（Homebrew cask 的包裝腳本），程式本體在 `/Applications/Blender.app` |
| 作業系統 | macOS 27.2.1，Apple M4（arm64），24 GB |
| glTF 匯入匯出 | Khronos glTF Blender I/O v5.2.40（內建） |
| Python | Blender 內建的（腳本裡 `import bpy, bmesh, mathutils` 都可用） |

- `blender -b -P <腳本.py> -- <參數>` 能跑。第一支實際跑過的腳本是 `games/tools/blender/inspect-parts.py`（A2 用的：匯入、套動作、量距離、出圖、匯出），約 20 秒跑完六個檔。
- 無頭模式下 Workbench 可以出圖（這台有顯卡；`render.engine = "BLENDER_WORKBENCH"`）。EEVEE 和 Cycles 沒試。
- 啟動時會印兩行和這個專案無關的外掛警告（`cloudmac_app_guard`、`cloudmac_secure_blender`），不影響執行。
- 腳本放在 `games/tools/blender/`（不是原本說的 `tools/blender/`：倉庫根目錄的工具是引擎的，遊戲和人物工具在 `games/tools/`）。

## Blender 5.x 寫腳本要注意的（寫 A2 腳本時碰到的）

- 動作要連同 slot 一起指定：`ad.action = action` 之後 `ad.action_slot = action.slots[0]`，不然不會動。
- 法線用 `mesh.corner_normals[i].vector`；`calc_normals_split()` 已經沒有了。
- glTF 匯入器會多放一個 `Icosphere`（畫骨頭用）。要找模型本身，篩「有骨架修改器的網格」。
- 匯入的 Y 軸朝上會轉成 Z 軸朝上，角色的正面朝 −Y。

## 接下來能做、還沒做的

D3（布料模擬當標準答案）、權重轉移、展 UV、烘焙、減面都需要先寫腳本。這一輪沒有做。
