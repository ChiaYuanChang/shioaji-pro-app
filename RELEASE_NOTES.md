## v0.1.23 — AI Agent Codex parity 大升級

### AI Agent 核心能力
- **更接近 Codex 的 agent loop**：支援 context compaction、plan steps、slash palette、`@代碼/股名` 商品帶入、輸入歷史、Esc-Esc backtrack、fork lineage、恢復對話 replay 與 stale snapshot 提醒。
- **工具執行更完整**：新增 `run_shell`、workspace file tools、`edit_file`、exec sessions、generic approval、背景 shell session 輪詢/中止，以及更完整的 Tauri scope。
- **MCP 與 web search**：支援 MCP client / per-session MCP 設定，並接上 provider-hosted web search。
- **多模態與互動**：支援 vision input、structured questions、queued user steering、queue recall、完成通知、`/review`、`/status`、`/model`。

### 交易安全與環境感知
- **同步 approval round-trip**：下單提案、允許/拒絕、工具結果會回到 model，agent 可依使用者決策接續處理。
- **trade-policy engine**：自動下單不是豁免；超量、市價開倉、價格偏離等風險會被 prompt 或直接擋下。
- **分析模式**：新增全域 analysis mode，強制唯讀，排程任務也遵守。
- **交易環境進 context**：模擬/正式狀態會注入 agent context，恢復舊 session 時若環境改變會提醒；AI Agent UI 不再重複顯示模擬 chip，正式真錢警示仍保留。

### Agent UX
- **Codex-style content-first chat**：減少 box-in-box 視覺噪音，工具呼叫 running → done 原地更新，輸出過長時截斷並保留摘要。
- **Composer context chips**：開新對話即可切工作資料夾、模型、權限；工作資料夾支援信任模型，只有 trusted folder 才載入 `AGENTS.md` / `NOTES.md`。
- **Session 管理強化**：對話列表支援搜尋、分組、重新命名、per-session storage，避免 WKWebView 不支援 `window.prompt` 的 rename 問題。
- **權限選單**：新增 Codex / Claude Code 風格的 permission dropdown，可快速切分析模式、確認下單、自動下單。
- **模型選單對齊 Codex**：Reasoning / Model / Speed 分層選單，支援 reasoning effort 與 Fast mode；選完自動關閉、點外面或 Esc 關閉、模型選單與權限選單互斥；Fast 模式下才顯示閃電 icon。

### Provider / Model
- **Reasoning effort**：Codex Responses API 使用 `reasoning.effort`；OpenAI Chat Completions 使用 `reasoning_effort`；Anthropic 以 thinking budget 映射 low / medium / high / xhigh。
- **Fast mode**：OpenAI / Codex request 帶 `service_tier: "priority"`；UI 顯示標準/快速狀態。
- **模型回退**：Codex backend 若退役 model slug，會自動 fallback 到可用模型並記住切換。

### 文件與網站
- README 與 landing page 補上功能截圖 gallery，並修正 renamed screenshots 的 broken links。

---

⚠ AI 分析僅供參考；自動下單請自行評估風險，盈虧自負。

Shioaji Pro 桌面版 — 內建 shioaji server（sidecar）、伺服器管理介面、系統匣、自動更新。

下載：macOS `.dmg` ｜ Windows `.msi` / `.exe` ｜ Linux `.AppImage` / `.deb` / `.rpm`
