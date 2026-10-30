# 3D 接入補強接收矩陣

2026-10-30。對應《深潮求生》移植評估；這是引擎補強與獨立可執行切片的證據，完整遊戲 P0／P1 接收仍須遊戲方實際操作通過。

| 評估項 | 本次交付 | 驗證與待辦 |
| --- | --- | --- |
| P0.1 外部建置／runtime | 獨立 HTML/CSS、無來源寫入、相對資源、ZIP/解壓上限、依賴雜湊、container/DPR/AA/FPS、pause、realm context loss 重建 | source hash／ZIP／錯誤路徑自動測試；真實 WebGL 的 root/subpath／opaque sandbox／狀態重建。正式遊戲站 iframe/CORS 仍需部署後驗收 |
| P0.2 網格／材質 | PBR/Unlit/custom shader、MR 貼圖轉換、動態 buffer/bounds、穩定 ID instance、深度/opaque pass 預算 | 真實海面／斜坡島／浮體／屋頂；256 個 GPU 波浪採樣，最大高度差 0.000011753 m；受擊、晴雨與擋雨。完整原場景視覺對照及風動植被仍在遊戲方 |
| P0.3 模型／生命週期 | 去重/retry/abort/lease、`.bin` GLB/relative JPG、獨立材質、命名節點、隔離預覽、過期結果丟棄 | 三款真實模型；30 次完整小場景建立/拆除保持有界；共享 JPG 存活。模型無 animation，含動畫/骨骼資產仍需另驗 |
| P0.4 查詢／座標／輸入 | 最近 hit/layer/instance ID、可注入 ray/sweep/surface、CSS projection/ray、相機 rig、多指角色/capture/cancel | AABB 最近遮擋測試；DPR1/2/3 × 桌面/直橫屏回投；雙指移動/轉向/放開；DOM 控制保留。完整魚鉤/建造判定仍沿用 shared gameplay |
| P0.5 時間／掛點 | fixed clock、snapshot interpolation/bounded extrapolation、epoch/sequence、TTL event gate、3D matrix/quaternion anchor | 10Hz snapshot 的 30/60/120FPS 自動測試；重複/亂序/新局/抑制 replay；旋轉與非均勻縮放掛點。真實斷線重連、天氣存檔與音訊仍由遊戲測試接收 |
| P1.6 大場景／品質 | region ownership、instance group、LOD hysteresis、DPR/shadow/pass 品質預算、資源清單與容量估算 | 小場景有界拆除及可切畫質已驗；兩模式的完整生成、密集建築/戰鬥/決勝與長距航行尚未驗收 |
| P1.7 消費端／手機 | 獨立固定版 SDK 消費專案、公開型別測試、真實 WebGL/CDP/CI、裝置原始報告 | iPhone14 ≥10分鐘通過本切片門檻；Android 佔用，尚未測；263項遊戲測試分類尚未執行 |

## 實際修正

1. `createMaterial` 忽略 PBR/Unlit 選項，現在回傳正確材質並保留 BlinnPhong 預設型別相容性。
2. 外部 build 會注入示範資產和固定 HTML，現在有獨立 read-only consumer pipeline。
3. DPR 被 design-size 與 retinal 重複乘入，iPhone 原本吃到 DPR3，現在 cap 真正生效。
4. Safari 整數 16/17ms frame timestamps 被過窄 tolerance 誤跳幀，更新 pacing 已修正。
5. Laya342 每個 WebRender3DProcess 的 fallback shadow texture 未釋放，版本 adapter 補釋放；連續30次拆除不再逐次增長。
6. glTF renderer 掛在 component 時舊材質複製路徑未涵蓋，現在正確複製並避免同皮膚角色一起變色。
7. custom shader 的 comma-separated uniform 與 Laya 自動注入重複，已整理宣告並通過實際編譯。
8. opaque-origin storage 存取讓初始化拋錯，現在提供 realm 內 memory fallback，持久資料由 parent 管理。

## 手機證據範圍

獨立消費專案 `evidence/iphone14-10min.json`：Safari27.0.1／iPhone14，low、DPR1，有效採樣614.525秒、36,545幀，P50=17ms／P95=20ms／P99=24ms，>50ms長幀0，interruption0。每45秒晴雨切換；4角色、1木筏、1船、1屋頂、48物資、0..160雨滴。原始 viewport／UA／draws／triangles 也在報告。此報告在後續純 API／型別／opaque storage 收尾之前擷取，low 的渲染預算一致；消費端最終版另跑桌面回歸。

不能由這個負載推導百人伺服器或全地圖幀率。GPU時間不可用，保持null；記憶體數字明確是估算。

## 正式遊戲切換之前

保留既有20個shared模組的移動/傷害/建造/存檔與網路權威，做出包含走路、游泳、上下船、建造、擋鉤、勾物資與扣血的可玩切片，再接收P0。之後才擴完整兩模式並完成P1。引擎沒有改寫這些規則，也沒有把本驗收頁當成完整遊戲。

獨立場景與報告：[zhuda-3d-lab](https://github.com/zhudaandzhuer/zhuda-3d-lab)。API與使用方式：[3D接入契約](3d-integration.md)。
