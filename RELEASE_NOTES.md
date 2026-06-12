## v0.1.21 — AI Agent 體驗大改版、技能市集

### AI Agent 對話介面（Claude Code 式）
- **工具列逐列堆疊**：每個工具呼叫一列（狀態點＋名稱＋參數摘要），同名連續呼叫自動收合（如 `get_quote ×9`），點開展開完整參數與結果；失敗呼叫紅點標示
- **思考過程**：模型推理摘要以收合列呈現，點開看 agent 怎麼想
- **「/」技能選單**：輸入 `/` 跳出技能面板，↑↓ 選、Tab 補全、Enter 直接執行
- **批次快照**：新增 get_snapshots 工具，多檔報價一次取得，不再逐檔輪詢

### 技能市集
- 從 Claude plugin marketplace 格式的 GitHub repo **安裝技能包**（輸入 owner/repo 即可）
- 預裝 [Sinotrade/Shioaji](https://github.com/Sinotrade/Shioaji) 的 shioaji 技能包：SKILL.md＋21 份 API 參考文件，agent 遇到 API 細節按需查閱原文，不憑記憶回答
- 技能包可一鍵更新／移除

### 常駐操作觀察學習
- App 記錄你的操作軌跡（選商品、開面板、下單 — 本機保存、可關閉）
- 每日收盤前 agent 自動回顧，把重複的 workflow 收斂成可直接呼叫的技能

### 架構
- **Web 介面開源**；桌面版（Tauri 整合＋ AI Agent）為專屬功能

---

⚠ AI 分析僅供參考；自動下單請自行評估風險，盈虧自負。Codex 訂閱通道為非官方文件化端點。

Shioaji Pro 桌面版 — 內建 shioaji server（sidecar）、伺服器管理介面、系統匣、自動更新。

下載：macOS `.dmg` ｜ Windows `.msi` / `.exe` ｜ Linux `.AppImage` / `.deb` / `.rpm`
