# Commodity HQ

A virtual office simulator for agricultural commodity futures analysis, powered by Claude AI.

以 Claude AI 驅動的虛擬農產品期貨分析辦公室。

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Claude](https://img.shields.io/badge/AI-Claude%20CLI-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What is this? | 這是什麼？

Commodity HQ simulates a commodity trading research office with **19 AI-powered analysts**, each with a unique personality, specialty, and prompt. You can chat with them individually or run a **multi-agent analysis pipeline** that orchestrates 4 phases of research and produces a synthesized report.

Commodity HQ 模擬一間商品期貨研究辦公室，裡面有 **19 個 AI 分析師**，每個人都有獨立的個性、專長和 prompt。你可以跟他們單獨聊天，也可以啟動**多 Agent 分析流程**，自動跑 4 階段研究並產出綜合報告。

### Features | 功能

- **19 AI Characters | 19 個 AI 角色** — WASDE expert, news analyst, COT analyst, macro strategist, quant researcher, technical analyst, and more
- **Multi-Agent Analysis Pipeline | 多 Agent 分析流程** — 4-phase orchestrated analysis (FX+News → Fundamentals → COT+Tech → Quant) with a synthesizer that applies kill criteria and veto framework
- **Real-time Market Data | 即時行情** — Live quotes from Yahoo Finance, K-line candlestick charts
- **Databento Integration | Databento 整合** — Historical OHLCV data queries (requires API key)
- **Correlation Matrix | 相關性矩陣** — Commodity price correlation heatmap (3M/6M/1Y)
- **Economic Calendar | 經濟日曆** — Upcoming WASDE, FOMC, EIA, NFP, CPI events with countdown
- **Group Discussion | 群組討論室** — Multi-agent roundtable discussion on any topic
- **Casino Mini-Games | 賭場小遊戲** — Blackjack, Roulette, Slots, Texas Hold'em
- **LaTeX Math Rendering | 數學公式渲染** — KaTeX for quantitative responses
- **Responsive Design | 響應式設計** — Works on desktop and mobile
- **Saved Reports | 報告儲存** — Analysis reports saved to localStorage

### Characters | 角色一覽

| Name | Role | 職位 | Model |
|------|------|------|-------|
| Alice | WASDE Supply/Demand Expert | WASDE 供需專家 | Opus |
| Nina | News Analyst | 新聞分析師 | Sonnet |
| Vera | COT Position Analyst | COT 持倉分析 | Sonnet |
| Raj | Macro/FX Strategist | 宏觀/外匯策略師 | Opus |
| Leo | Soft Commodities | 軟商品基本面 | Sonnet |
| Max | Quant Researcher | 量化研究員 | Opus |
| Hana | Technical Analyst | 技術分析師 | Sonnet |
| Kai | Energy & Metals | 能源/金屬 | Sonnet |
| Dario | Anthropic CEO | Anthropic CEO | Sonnet |
| Sam | OpenAI CEO | OpenAI CEO | Sonnet |
| Gary | Office Slacker | 辦公室擺爛王 | Sonnet |
| Luna | English Coach | 英語教練 | Opus |
| Ming | Intern | 實習生 | Sonnet |
| Felix | Contrarian Signal Hunter | 反向指標專家 | Sonnet |
| Zhang | 30-Year Market Senior Player | 30 年期貨資深玩家 | Sonnet |
| Sophie | Devil's Advocate / Risk | 魔鬼代言人 / 風控 | Sonnet |
| Dev | Python Code Generator | Python 程式碼產生器 | Sonnet |
| Ace | Poker Philosopher | 撲克哲學家 | Sonnet |
| Claude | AI Assistant | AI 助手 | Sonnet |

## Prerequisites | 前置需求

- **Node.js** 18+
- **Claude CLI** — installed and authenticated with a Claude Max subscription
  - The app uses `claude -p` (non-interactive mode) as the AI backend
  - Your Claude Max subscription provides the API access — no separate API key needed
  - 本應用透過 `claude -p` 作為 AI 後端，需要 Claude Max 訂閱
  - [Install Claude Code | 安裝 Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

## Quick Start | 快速開始

```bash
# Clone the repo | 複製 repo
git clone https://github.com/Chimmy-Ultra/commodity-hq.git
cd commodity-hq

# Install dependencies | 安裝依賴
npm install

# Copy environment template | 複製環境變數模板
cp .env.example .env

# Start the server | 啟動伺服器
npm start
```

Open `http://localhost:3000` in your browser. | 用瀏覽器開啟 `http://localhost:3000`。

### Mobile Access | 手機使用

Connect your phone to the same WiFi network, then open `http://<your-computer-ip>:3000`.

手機連到同一個 WiFi，然後開啟 `http://<你的電腦 IP>:3000`。

## Configuration | 設定

### `.env` file | `.env` 檔案

```env
PORT=3000
# DATABENTO_API_KEY=your_key_here   # Optional | 可選：用於歷史數據查詢
```

### Model Assignment | 模型分配

Edit `config/models.js` to change which Claude model each character uses. Opus is used for complex reasoning tasks (Max, Raj, Luna, Synthesizer), Sonnet for structured data gathering.

編輯 `config/models.js` 可調整每個角色使用的 Claude 模型。Opus 用在複雜推理，Sonnet 用在結構化資料收集。

## Tech Stack | 技術棧

- **Backend | 後端**: Node.js + Express
- **AI**: Claude CLI (claude -p) via Max subscription
- **Frontend | 前端**: Vanilla JS, CSS custom properties
- **Charts | 圖表**: Lightweight Charts (TradingView)
- **Math | 數學**: KaTeX
- **Markdown**: marked.js + DOMPurify
- **Avatars | 頭像**: DiceBear Adventurer + custom photos

## Project Structure | 專案結構

```
├── server.js              # Express server + API routes
├── config/
│   ├── prompts.js         # All character system prompts | 所有角色的 system prompt
│   ├── models.js          # Model assignment per character | 模型分配
│   ├── markets.js         # Live market panel config | 即時行情面板設定
│   └── commodities.js     # Commodity definitions | 商品定義
├── lib/
│   ├── claude-runner.js   # Claude CLI wrapper | Claude CLI 封裝器
│   ├── orchestrator.js    # Multi-agent analysis pipeline | 多 Agent 分析流程
│   ├── yahoo.js           # Yahoo Finance data fetcher | Yahoo Finance 資料抓取
│   └── databento.js       # Databento API client | Databento API 客戶端
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── characters.js  # Character roster + avatars | 角色名冊 + 頭像
│   │   ├── main.js        # Home page + sidebar | 首頁 + 側邊欄
│   │   ├── chat.js        # Chat panel | 聊天面板
│   │   ├── analysis.js    # Analysis pipeline UI | 分析流程 UI
│   │   ├── kline.js       # Candlestick charts | K 線蠟燭圖
│   │   ├── databento.js   # Databento query panel | Databento 查詢面板
│   │   ├── poker.js       # Texas Hold'em | 德州撲克
│   │   └── ...            # Other casino games | 其他賭場遊戲
│   └── img/avatars/       # Custom avatar images | 自訂頭像圖片
└── .env.example           # Environment template | 環境變數模板
```

## Security | 安全措施

- All markdown output sanitized with DOMPurify | 所有 Markdown 輸出皆經 DOMPurify 消毒
- Rate limiting on chat (30/min) and analysis (5/min) endpoints | 聊天及分析端點有速率限制
- Input validation (message count/length limits) | 輸入驗證（訊息數量/長度上限）
- No API keys in source code | 原始碼不含任何 API key
- CDN scripts loaded with SRI integrity hashes | CDN 腳本附帶 SRI 完整性雜湊

## License | 授權

MIT
