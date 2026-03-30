# AgriAnalytics HQ

以 Claude AI 驅動的虛擬農產品期貨分析辦公室。

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Claude](https://img.shields.io/badge/AI-Claude%20CLI-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

## 這是什麼？

AgriAnalytics HQ 模擬一間商品期貨研究辦公室，裡面有 **19 個 AI 分析師**，每個人都有獨立的個性、專長和 prompt。你可以跟他們單獨聊天，也可以啟動**多 Agent 分析流程**，自動跑 4 階段研究並產出綜合報告。

### 功能

- **19 個 AI 角色** — WASDE 專家、新聞分析師、COT 分析師、宏觀策略師、量化研究員、技術分析師等
- **多 Agent 分析流程** — 4 階段協作分析（外匯+新聞 → 基本面 → COT+技術 → 量化），加上綜合器的否決機制和 kill criteria
- **即時行情** — Yahoo Finance 即時報價、K 線蠟燭圖
- **Databento 整合** — 歷史 OHLCV 數據查詢（需要 API key）
- **賭場小遊戲** — 21 點、輪盤、老虎機、德州撲克（分析完放鬆用）
- **LaTeX 數學公式** — KaTeX 即時渲染量化回覆
- **響應式設計** — 桌面和手機都能用
- **報告儲存** — 分析報告自動存到 localStorage

### 角色一覽

| 名字 | 職位 | 模型 |
|------|------|------|
| Alice | WASDE 供需專家 | Opus |
| Nina | 新聞分析師 | Sonnet |
| Vera | COT 持倉分析 | Sonnet |
| Raj | 宏觀/外匯策略師 | Opus |
| Leo | 軟商品基本面 | Sonnet |
| Max | 量化研究員 | Opus |
| Hana | 技術分析師 | Sonnet |
| Kai | 能源/金屬 | Sonnet |
| Dario | Anthropic CEO (?) | Sonnet |
| Sam | OpenAI CEO (?) | Sonnet |
| Gary | 辦公室擺爛王 | Sonnet |
| Luna | 英語教練 | Opus |
| Ming | 實習生 | Sonnet |
| Felix | 反向指標專家 | Sonnet |
| Zhang | 30 年期貨老兵 | Sonnet |
| Sophie | 魔鬼代言人 / 風控 | Sonnet |
| Dev | Python 程式碼產生器 | Sonnet |
| Ace | 撲克哲學家 | Sonnet |
| Claude | AI 助手 | Sonnet |

## 前置需求

- **Node.js** 18+
- **Claude CLI** — 已安裝並登入 Claude Max 訂閱方案
  - 本應用透過 `claude -p`（非互動模式）作為 AI 後端
  - 你的 Claude Max 訂閱提供 API 額度，不需要另外的 API key
  - [安裝 Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

## 快速開始

```bash
# 複製 repo
git clone https://github.com/Chimmy-Ultra/agrianalytics-hq.git
cd agrianalytics-hq

# 安裝依賴
npm install

# 複製環境變數模板
cp .env.example .env

# 啟動伺服器
npm start
```

用瀏覽器開啟 `http://localhost:3000`。

### 手機使用

手機連到同一個 WiFi，然後開啟 `http://<你的電腦 IP>:3000`。

## 設定

### `.env` 檔案

```env
PORT=3000
# DATABENTO_API_KEY=your_key_here   # 可選：用於歷史數據查詢
```

### 模型分配

編輯 `config/models.js` 可以調整每個角色使用的 Claude 模型。Opus 用在複雜推理任務（Max、Raj、Luna、綜合器），Sonnet 用在結構化資料收集。

## 技術棧

- **後端**：Node.js + Express
- **AI**：Claude CLI（claude -p），透過 Max 訂閱
- **前端**：原生 JS、CSS custom properties
- **圖表**：Lightweight Charts（TradingView）
- **數學**：KaTeX
- **Markdown**：marked.js + DOMPurify
- **頭像**：DiceBear Adventurer + 自訂照片

## 專案結構

```
├── server.js              # Express 伺服器 + API 路由
├── config/
│   ├── prompts.js         # 所有角色的 system prompt
│   ├── models.js          # 每個角色的模型分配
│   ├── markets.js         # 即時行情面板設定
│   └── commodities.js     # 商品定義
├── lib/
│   ├── claude-runner.js   # Claude CLI 封裝器
│   ├── orchestrator.js    # 多 Agent 分析流程
│   ├── yahoo.js           # Yahoo Finance 資料抓取
│   └── databento.js       # Databento API 客戶端
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── characters.js  # 角色名冊 + 頭像
│   │   ├── main.js        # 首頁 + 側邊欄
│   │   ├── chat.js        # 聊天面板
│   │   ├── analysis.js    # 分析流程 UI
│   │   ├── kline.js       # K 線蠟燭圖
│   │   ├── databento.js   # Databento 查詢面板
│   │   ├── poker.js       # 德州撲克
│   │   └── ...            # 其他賭場遊戲
│   └── img/avatars/       # 自訂頭像圖片
└── .env.example           # 環境變數模板
```

## 安全措施

- 所有 Markdown 輸出皆經 DOMPurify 消毒
- 聊天（30 次/分鐘）及分析（5 次/分鐘）端點有速率限制
- 輸入驗證（訊息數量/長度上限）
- 原始碼不含任何 API key
- CDN 腳本載入時附帶 SRI 完整性雜湊

## 授權

MIT
