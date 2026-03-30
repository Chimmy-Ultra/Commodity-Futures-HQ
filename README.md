# AgriAnalytics HQ

A virtual office simulator for agricultural commodity futures analysis, powered by Claude AI.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Claude](https://img.shields.io/badge/AI-Claude%20CLI-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

## What is this?

AgriAnalytics HQ simulates a commodity trading research office with **19 AI-powered analysts**, each with a unique personality, specialty, and prompt. You can chat with them individually or run a **multi-agent analysis pipeline** that orchestrates 4 phases of research and produces a synthesized report.

### Features

- **19 AI Characters** — WASDE expert, news analyst, COT analyst, macro strategist, quant researcher, technical analyst, and more
- **Multi-Agent Analysis Pipeline** — 4-phase orchestrated analysis (FX+News → Fundamentals → COT+Tech → Quant) with a synthesizer that applies kill criteria and veto framework
- **Real-time Market Data** — Live quotes from Yahoo Finance, K-line candlestick charts
- **Databento Integration** — Historical OHLCV data queries (requires API key)
- **Casino Mini-Games** — Blackjack, Roulette, Slots, Texas Hold'em (for stress relief between analyses)
- **LaTeX Math Rendering** — KaTeX for quantitative responses
- **Responsive Design** — Works on desktop and mobile
- **Saved Reports** — Analysis reports saved to localStorage

### Characters

| Name | Role | Model |
|------|------|-------|
| Alice | WASDE Supply/Demand Expert | Opus |
| Nina | News Analyst | Sonnet |
| Vera | COT Position Analyst | Sonnet |
| Raj | Macro/FX Strategist | Opus |
| Leo | Soft Commodities | Sonnet |
| Max | Quant Researcher | Opus |
| Hana | Technical Analyst | Sonnet |
| Kai | Energy & Metals | Sonnet |
| Dario | Anthropic CEO (?) | Sonnet |
| Sam | OpenAI CEO (?) | Sonnet |
| Gary | Office Slacker | Sonnet |
| Luna | English Coach | Opus |
| Ming | Intern | Sonnet |
| Felix | Contrarian Signal Hunter | Sonnet |
| Zhang | 30-Year Market Veteran | Sonnet |
| Sophie | Devil's Advocate / Risk | Sonnet |
| Dev | Python Code Generator | Sonnet |
| Ace | Poker Philosopher | Sonnet |
| Claude | AI Assistant | Sonnet |

## Prerequisites

- **Node.js** 18+
- **Claude CLI** — installed and authenticated with a Claude Max subscription
  - The app uses `claude -p` (non-interactive mode) as the AI backend
  - Your Claude Max subscription provides the API access — no separate API key needed
  - [Install Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/agrianalytics-hq.git
cd agrianalytics-hq

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start the server
npm start
```

Open `http://localhost:3000` in your browser.

### Mobile Access

Connect your phone to the same WiFi network, then open `http://<your-computer-ip>:3000`.

## Configuration

### `.env` file

```env
PORT=3000
# DATABENTO_API_KEY=your_key_here   # Optional: for historical data queries
```

### Model Assignment

Edit `config/models.js` to change which Claude model each character uses. Opus is used for complex reasoning tasks (Max, Raj, Luna, Synthesizer), Sonnet for structured data gathering.

## Tech Stack

- **Backend**: Node.js + Express
- **AI**: Claude CLI (claude -p) via Max subscription
- **Frontend**: Vanilla JS, CSS custom properties
- **Charts**: Lightweight Charts (TradingView)
- **Math**: KaTeX
- **Markdown**: marked.js + DOMPurify
- **Avatars**: DiceBear Adventurer + custom photos

## Project Structure

```
├── server.js              # Express server + API routes
├── config/
│   ├── prompts.js         # All character system prompts
│   ├── models.js          # Model assignment per character
│   ├── markets.js         # Live market panel config
│   └── commodities.js     # Commodity definitions
├── lib/
│   ├── claude-runner.js   # Claude CLI wrapper
│   ├── orchestrator.js    # Multi-agent analysis pipeline
│   ├── yahoo.js           # Yahoo Finance data fetcher
│   └── databento.js       # Databento API client
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── characters.js  # Character roster + avatars
│   │   ├── main.js        # Home page + sidebar
│   │   ├── chat.js        # Chat panel
│   │   ├── analysis.js    # Analysis pipeline UI
│   │   ├── kline.js       # Candlestick charts
│   │   ├── databento.js   # Databento query panel
│   │   ├── poker.js       # Texas Hold'em
│   │   └── ...            # Other casino games
│   └── img/avatars/       # Custom avatar images
└── .env.example           # Environment template
```

## Security

- All markdown output sanitized with DOMPurify
- Rate limiting on chat (30/min) and analysis (5/min) endpoints
- Input validation (message count/length limits)
- No API keys in source code
- CDN scripts loaded with SRI integrity hashes

## License

MIT
