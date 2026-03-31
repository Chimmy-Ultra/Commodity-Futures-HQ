# Commodity HQ

A virtual office simulator for commodity futures analysis, powered by Claude AI.

以 Claude AI 驅動的虛擬商品期貨分析辦公室。

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Claude](https://img.shields.io/badge/AI-Claude%20CLI-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What is this? | 這是什麼？

Commodity HQ simulates a commodity trading research office with **19 AI-powered characters** — 8 analysis specialists who participate in a multi-agent pipeline, and 11 office characters for chat. You can talk to anyone individually, or run the **multi-agent analysis pipeline** that orchestrates 5 phases of layered research and produces a synthesized trading report with a built-in veto framework.

Commodity HQ 模擬一間商品期貨研究辦公室，裡面有 **19 個 AI 角色** — 8 位分析專員負責多 Agent 分析流程，11 位辦公室角色提供聊天互動。你可以跟任何人單獨對話，也可以啟動**多 Agent 分析流程**，自動執行 5 階段分層研究，產出含否決機制的綜合交易報告。

---

## Features | 功能

- **8 Analysis Specialists + 11 Office Characters | 8 位分析專員 + 11 位辦公室角色**
- **Multi-Agent Analysis Pipeline | 多 Agent 分析流程** — 5-phase orchestrated analysis with kill criteria and veto framework
- **Real-time Market Data | 即時行情** — Live quotes from Yahoo Finance with per-character panels
- **K-line Candlestick Charts | K 線蠟燭圖** — 13 symbols, multiple timeframes (TradingView Lightweight Charts)
- **Correlation Matrix | 相關性矩陣** — Commodity price correlation heatmap (3M/6M/1Y)
- **Economic Calendar | 經濟日曆** — 13 event types (WASDE, FOMC, EIA, NFP, CPI...) with 60-day lookahead
- **Group Discussion | 群組討論室** — 2–5 characters discuss any topic, sequential with full context
- **Databento Integration | Databento 整合** — Historical OHLCV data queries (optional API key)
- **Casino Corner | 賭場角落** — Blackjack, Roulette, Slots, Texas Hold'em, Big Two (大老二)
- **Chat | 聊天** — Individual conversations with Markdown, KaTeX math, code highlighting
- **Saved Reports | 報告儲存** — Up to 50 analysis reports in localStorage
- **Responsive Design | 響應式設計** — Desktop and mobile

---

## Characters | 角色一覽

### Analysis Specialists (8) | 分析專員

These 8 characters participate in the **multi-agent analysis pipeline**. Each occupies a specific phase and role.

這 8 位角色參與**多 Agent 分析流程**，各自負責特定階段和專業。

| Name | ID | Role | Phase | Model | 職位 |
|------|----|------|-------|-------|------|
| Raj | `fx` | Macro/FX Strategist | 1 | Opus | 宏觀/外匯策略師 |
| Nina | `news` | News Analyst | 1 | Sonnet | 新聞分析師 |
| Alice | `wasde` | WASDE Supply/Demand Expert | 2 (Grains) | Opus | WASDE 供需專家 |
| Leo | `soft` | Soft Commodities Analyst | 2 (Softs) | Sonnet | 軟商品基本面 |
| Kai | `energy` | Energy & Metals Analyst | 2 (Energy/Metals) | Sonnet | 能源/金屬 |
| Vera | `cot` | COT Position Analyst | 3 | Sonnet | COT 持倉分析 |
| Hana | `tech` | Technical Analyst | 3 | Sonnet | 技術分析師 |
| Max | `quant` | Quant Researcher | 4 | Opus | 量化驗證 |

> **Note**: Phase 2 uses exactly **one** fundamental analyst depending on the commodity type — Alice for grains, Leo for softs, Kai for energy/metals.

### Office Characters (11) | 辦公室角色

These 11 characters are **chat-only** companions. They do **NOT** participate in the analysis pipeline.

這 11 位角色**僅供聊天**，**不參與**分析流程。

| Name | ID | Role | Model | Live Panel | 職位 |
|------|----|------|-------|------------|------|
| Dario | `dario` | "Anthropic CEO (?)" | Sonnet | ✅ | 誤入農產品公司的 AI 安全專家 |
| Sam | `sam` | "OpenAI CEO (?)" | Sonnet | ✅ | 神秘出現的 AGI 佈道者 |
| Gary | `slacker` | Office Slacker | Sonnet | ✅ | 辦公室擺爛王 |
| Luna | `luna` | English Coach | Opus | — | 英語教練 |
| Ming | `intern` | Intern | Sonnet | — | 實習生 |
| Felix | `conspiracy` | Contrarian Signal Hunter | Sonnet | — | 反向指標專家 |
| Zhang | `veteran` | 30-Year Market Veteran | Sonnet | — | 活歷史資料庫 |
| Sophie | `risk` | Devil's Advocate / Risk | Sonnet | — | 魔鬼代言人 / 風控 |
| Dev | `dev` | Python Code Generator | Sonnet | — | 程式碼產生器 |
| Ace | `poker` | Poker Philosopher | Sonnet | — | 撲克哲學家 |
| Claude | `claude` | AI Assistant | Sonnet | — | AI 助手 |

---

## Multi-Agent Analysis Pipeline | 多 Agent 分析流程

This is the core feature. The pipeline orchestrates 8 specialist agents across 5 sequential phases to produce a comprehensive commodity trading report.

這是核心功能。系統將 8 位專業 Agent 編排為 5 個依序執行的階段，產出完整的商品交易分析報告。

### Two Modes | 兩種分析模式

| Mode | How it works | 運作方式 |
|------|-------------|----------|
| **Commodity Mode** | User selects a commodity → system uses a static agent mapping from `config/commodities.js` | 用戶選擇商品 → 系統使用靜態 agent 配置 |
| **Custom Question Mode** | User types a free-form question → an LLM Router (Claude) reads it and decides which agents to activate, outputting a JSON plan with agent IDs and per-agent sub-questions | 用戶輸入自由問題 → LLM Router 決定啟用哪些 agents |

### Commodity → Agent Mapping | 商品-Agent 對照

| Category | Commodities | Agent Sequence |
|----------|------------|----------------|
| **Grains** | Corn, Soybeans, Wheat | `fx` → `news` → `wasde` → `cot` → `tech` → `quant` |
| **Softs** | Coffee, Sugar, Cotton | `fx` → `news` → `soft` → `cot` → `tech` → `quant` |
| **Energy & Metals** | Natural Gas, WTI, Gold, Silver, Palladium | `fx` → `news` → `energy` → `cot` → `tech` → `quant` |
| **FX** | USD/JPY | `fx` → `news` → `tech` *(3 agents only, no Phase 4)* |

### Phase Execution Flow | 階段執行流程

```
 ┌──────────────── PHASE 1: Macro Context + Catalysts ─────────────────┐
 │                  (no prior context needed)                          │
 │                                                                     │
 │   ┌──────────────────┐              ┌──────────────────┐           │
 │   │   Raj (fx)       │  ─PARALLEL─  │   Nina (news)    │           │
 │   │   OPUS           │              │   SONNET         │           │
 │   │                  │              │                  │           │
 │   │ DXY, Fed/BOJ,    │              │ Recent catalysts,│           │
 │   │ real rates,      │              │ event calendar,  │           │
 │   │ capital flows    │              │ sentiment scan   │           │
 │   └────────┬─────────┘              └────────┬─────────┘           │
 └────────────┼─────────────────────────────────┼──────────────────────┘
              └──────────────┬──────────────────┘
                             ▼  Phase 1 results passed as context
 ┌──────────────── PHASE 2: Fundamentals ──────────────────────────────┐
 │                  (receives Phase 1 context)                         │
 │                                                                     │
 │   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐          │
 │   │ Alice (wasde)│   │  Leo (soft)  │   │  Kai (energy)│          │
 │   │ Grains       │   │  Softs       │   │ Energy/Metals│          │
 │   │ USDA S&D,    │   │ Production,  │   │ EIA, OPEC,   │          │
 │   │ stocks/use   │   │ weather,     │   │ ETF flows,   │          │
 │   │ ratio        │   │ crop cycle   │   │ central banks│          │
 │   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘          │
 │          └──── EXACTLY ONE runs per commodity ──┘                   │
 └─────────────────────────────┬───────────────────────────────────────┘
                               ▼  Phase 1+2 results passed as context
 ┌──────────────── PHASE 3: Positioning + Technicals ──────────────────┐
 │                  (receives Phase 1+2 context)                       │
 │                                                                     │
 │   ┌──────────────────┐              ┌──────────────────┐           │
 │   │   Vera (cot)     │  ─PARALLEL─  │   Hana (tech)    │           │
 │   │   SONNET         │              │   SONNET         │           │
 │   │                  │              │                  │           │
 │   │ CFTC positioning,│              │ Weekly trend,    │           │
 │   │ managed money,   │              │ daily tactics,   │           │
 │   │ crowding risk    │              │ S/R levels,      │           │
 │   │                  │              │ RSI, MACD, SMA   │           │
 │   └────────┬─────────┘              └────────┬─────────┘           │
 └────────────┼─────────────────────────────────┼──────────────────────┘
              └──────────────┬──────────────────┘
                             ▼  Phase 1+2+3 results passed as context
 ┌──────────────── PHASE 4: Quant Validation ──────────────────────────┐
 │                  (receives ALL prior context)                       │
 │                                                                     │
 │                  ┌──────────────────────┐                           │
 │                  │   Max (quant) OPUS   │                           │
 │                  │                      │                           │
 │                  │ Momentum signals,    │                           │
 │                  │ volatility regime,   │                           │
 │                  │ seasonal backtest,   │                           │
 │                  │ correlation check    │                           │
 │                  │                      │                           │
 │                  │ ⚠ CAN VETO THE TRADE │                           │
 │                  └──────────┬───────────┘                           │
 └─────────────────────────────┼───────────────────────────────────────┘
                               ▼  ALL results (Phase 1-4) passed
 ┌──────────────── PHASE 5: Synthesis ─────────────────────────────────┐
 │                                                                     │
 │                  ┌──────────────────────┐                           │
 │                  │  Synthesizer (OPUS)  │                           │
 │                  │  "Portfolio Manager" │                           │
 │                  │                      │                           │
 │                  │ Consolidates all     │                           │
 │                  │ agent views,         │                           │
 │                  │ applies KILL         │                           │
 │                  │ CRITERIA,            │                           │
 │                  │ produces final       │                           │
 │                  │ BUY / SELL / HOLD    │                           │
 │                  └──────────┬───────────┘                           │
 └─────────────────────────────┼───────────────────────────────────────┘
                               ▼
                     ┌─────────────────┐
                     │  FINAL REPORT   │
                     │  BUY/SELL/HOLD  │
                     └─────────────────┘
```

### Key Design Principles | 核心設計原則

- **Phases run sequentially** (1 → 2 → 3 → 4 → 5) — each phase builds on prior results
- **Agents within a phase run in parallel** (`Promise.all`) — e.g., Raj and Nina run simultaneously in Phase 1
- **Context accumulation** — each agent receives a `[PRIOR ANALYSIS CONTEXT]` block containing all earlier phases' outputs
- **Phase 2 selects one agent** — Alice (grains), Leo (softs), or Kai (energy/metals) based on commodity type
- **USD/JPY skips Phase 4** — only 3 agents (fx, news, tech), no quant validation

### Kill Criteria / No-Trade Veto Framework | 否決框架

The Synthesizer (Phase 5) evaluates 6 kill criteria before producing a final recommendation. **If ANY criterion triggers, the recommendation is forced to HOLD.**

合成器（第 5 階段）在產出最終建議前會檢查 6 條否決條件。**任一條觸發即強制建議為 HOLD。**

| # | Kill Criterion | Trigger Condition |
|---|---------------|-------------------|
| 1 | **Fundamental-Positioning Conflict** | Bullish fundamentals + managed money at >85th percentile long (or inverse). Crowded trade risk. |
| 2 | **Quant Rejection** | Quant verdict is ❌, seasonal win rate < 50%, or mean reversion warning (>2σ, >70% reversal probability). |
| 3 | **Imminent Binary Event** | WASDE / FOMC / OPEC within 3 trading days. |
| 4 | **Analyst Disagreement** | Fundamental analyst and technical analyst disagree on direction. |
| 5 | **Extreme Volatility** | Volatility in >90th percentile of the past year. |
| 6 | **Correlation Breakdown** | >0.3 shift from normal cross-market correlation. |

When HOLD is triggered, the report:
- States which kill criterion fired
- Explains why entering now is suboptimal
- Defines specific **entry trigger conditions** (what must change before a trade becomes actionable)
- Replaces entry/stop/target prices with trigger conditions
- Sets a re-evaluation date or event

### SSE Streaming Events | 串流事件

The pipeline streams real-time progress to the frontend via Server-Sent Events:

| Event | Payload | Description |
|-------|---------|-------------|
| `plan` | agents, commodity, source | Initial agent lineup |
| `phase_start` | phase, agents[] | A phase begins |
| `agent_start` | agentId, name, phase | Agent starts working |
| `agent_done` | agentId, name, phase, response | Agent finished |
| `agent_error` | agentId, name, phase, error | Agent failed |
| `synthesis_start` | — | Synthesizer starts |
| `synthesis` | report | Final report (Markdown) |
| `complete` | — | Pipeline finished |

### Model Assignment | 模型分配策略

| Model | Agents | Rationale |
|-------|--------|-----------|
| **Opus** | Raj (fx), Max (quant), Alice (wasde), Synthesizer, Luna | Deep reasoning, independent thinking, conflict resolution |
| **Sonnet** | Nina, Vera, Hana, Leo, Kai, all office characters | Structured data gathering, table filling, pattern matching |

---

## Group Discussion | 群組討論室

Select 2–5 characters and provide a topic. Characters respond **sequentially**, each seeing all prior speakers' responses, creating a context-aware roundtable discussion. Streamed via SSE.

選擇 2–5 個角色並提供主題，角色**依序發言**，每位都能看到前面所有人的回應。透過 SSE 即時串流。

- Rate limit: 10 requests/min
- Topic max length: 2,000 characters

---

## Market Data | 市場數據

### Real-time Quotes | 即時行情
- Yahoo Finance data, 45-second cache per character panel
- Each analyst has a context-relevant panel (e.g., Raj sees USD/JPY + Gold + WTI; Alice sees Corn + Soybeans + Wheat)
- Sidebar displays all 13 tracked symbols

### K-line Charts | K 線圖
- **13 symbols**: Corn, Soybeans, Wheat, Coffee, Sugar, Cotton, WTI, Natural Gas, Gold, Silver, Palladium, USD/JPY, DXY
- **Timeframes**: Daily, Weekly, Monthly
- **Ranges**: 1M, 3M, 6M, 1Y, 2Y, 5Y
- Powered by TradingView Lightweight Charts

### Correlation Matrix | 相關性矩陣
- **10 commodities**: ZC, ZS, ZW, KC, SB, CL, NG, GC, SI, DXY
- Pearson correlation of daily returns
- Time windows: 3M / 6M / 1Y
- Heatmap visualization (red +1 → white 0 → blue -1)
- 1-hour cache

### Economic Calendar | 經濟日曆
- **13 event types** across 4 categories: Agriculture (WASDE, Crop Progress, Export Sales), Macro (FOMC, NFP, CPI, PPI, GDP, PCE), Energy (EIA, OPEC), Positioning (COT)
- 60-day lookahead with countdown timers
- Event dates fetched via Claude, 24-hour cache

### Databento Integration | Databento 整合
- Historical OHLCV data queries
- 5 datasets: CME Globex, NASDAQ, NYSE, OPRA, US Equities
- Requires `DATABENTO_API_KEY` in `.env` (optional)

---

## Casino Corner | 賭場角落

| Game | Players | Description |
|------|---------|-------------|
| **Blackjack** | 1v Dealer | Classic 21 — hit, stand, natural blackjack detection |
| **Roulette** | 1 | European wheel (0–36), bet on numbers/colors/odd-even/high-low |
| **Slots** | 1 | 3-reel machine with 6 symbols, varying payouts |
| **Texas Hold'em** | 1 + 8 AI | Full poker with 8 AI opponents, each with distinct personalities and play styles |
| **Big Two (大老二)** | 1 + 3 AI | Classic card game, NESW table layout, 3 AI opponents (Sam, Dario, Claude) |

All games feature humorous flavor dialogue from office characters.

---

## Prerequisites | 前置需求

- **Node.js** 18+
- **Claude CLI** — installed and authenticated with a **Claude Max subscription**
  - The app uses `claude -p` (non-interactive, stdin-piped) as the AI backend
  - Your Claude Max subscription provides the access — **no separate API key needed**
  - Prompts are sent via stdin, **no temp files** written to disk
  - [Install Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)
- **Databento API key** (optional) — only needed for historical data queries

## Quick Start | 快速開始

```bash
# Clone
git clone https://github.com/user/commodity-hq.git
cd commodity-hq

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start the server
npm start
```

Open `http://localhost:3000` in your browser.

### Mobile Access | 手機使用

Connect your phone to the same WiFi network, then open `http://<your-computer-ip>:3000`.

---

## Configuration | 設定

### `.env` file

```env
PORT=3000
# DATABENTO_API_KEY=your_key_here   # Optional: for historical data queries
```

### Model Assignment | 模型分配

Edit `config/models.js` to change which Claude model each character uses:
- **Opus** — complex reasoning, synthesis, independent veto (Quant, FX, WASDE, Synthesizer, Luna)
- **Sonnet** — structured data gathering, table filling (News, COT, Tech, Soft, Energy, all office characters)

---

## Tech Stack | 技術棧

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| AI | Claude CLI (`claude -p`) via Max subscription |
| Frontend | Vanilla JS (IIFE modules), CSS custom properties |
| Charts | Lightweight Charts (TradingView) |
| Math | KaTeX |
| Markdown | marked.js + DOMPurify |
| Avatars | DiceBear Adventurer + custom photos |

---

## Project Structure | 專案結構

```
├── server.js                  # Express server + all API routes
├── config/
│   ├── prompts.js             # All character system prompts
│   ├── models.js              # Opus vs Sonnet model assignment
│   ├── markets.js             # Live quote panel config per character
│   ├── commodities.js         # Commodity-agent mapping + sub-questions + LLM router
│   ├── calendar.js            # Economic event definitions + Claude date-fetch prompt
│   └── synthesizer.js         # Synthesis prompt + kill criteria + output format
├── lib/
│   ├── claude-runner.js       # Claude CLI wrapper (claude -p via stdin)
│   ├── orchestrator.js        # Multi-phase analysis pipeline execution
│   ├── yahoo.js               # Yahoo Finance data fetcher + caching
│   ├── databento.js           # Databento API client
│   └── correlation.js         # Pearson correlation matrix computation
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── characters.js      # 19 character definitions + avatars
│       ├── main.js            # Home page, sidebar, navigation
│       ├── chat.js            # Individual chat UI
│       ├── analysis.js        # Analysis pipeline UI (SSE consumer)
│       ├── group-chat.js      # Group discussion UI
│       ├── quotes.js          # Live market quote panels
│       ├── kline.js           # Candlestick chart rendering
│       ├── correlation.js     # Correlation matrix heatmap
│       ├── calendar.js        # Economic calendar panel
│       ├── databento.js       # Databento query panel
│       ├── blackjack.js       # Blackjack
│       ├── roulette.js        # Roulette
│       ├── slots.js           # Slots
│       ├── poker.js           # Texas Hold'em
│       └── bigtwo.js          # Big Two (大老二)
└── .env.example
```

---

## Security | 安全措施

- All Markdown output sanitized with **DOMPurify**
- **Rate limiting**: chat 30/min, analysis 5/min, group chat 10/min
- **Input validation**: max 50 messages, 8,000 chars/message, 2,000 chars/topic
- **100KB** JSON body limit
- CDN scripts loaded with **SRI integrity hashes**
- No API keys in source code
- Prompts piped via stdin — **no temp files on disk**

---

## License | 授權

MIT
