// Static mapping: commodity → which agents to consult
// Agents are listed in logical order; orchestrator assigns phases automatically
const COMMODITY_AGENTS = {
  corn:      ['fx', 'news', 'wasde', 'cot', 'tech', 'quant'],
  soybeans:  ['fx', 'news', 'wasde', 'cot', 'tech', 'quant'],
  wheat:     ['fx', 'news', 'wasde', 'cot', 'tech', 'quant'],
  coffee:    ['fx', 'news', 'soft', 'cot', 'tech', 'quant'],
  sugar:     ['fx', 'news', 'soft', 'cot', 'tech', 'quant'],
  cotton:    ['fx', 'news', 'soft', 'cot', 'tech', 'quant'],
  natgas:    ['fx', 'news', 'energy', 'cot', 'tech', 'quant'],
  wti:       ['fx', 'news', 'energy', 'cot', 'tech', 'quant'],
  gold:      ['fx', 'news', 'energy', 'cot', 'tech', 'quant'],
  silver:    ['fx', 'news', 'energy', 'cot', 'tech', 'quant'],
  palladium: ['fx', 'news', 'energy', 'cot', 'tech', 'quant'],
  usdjpy:    ['fx', 'news', 'tech'],
};

// Display names for the commodity selector
const COMMODITY_LABELS = {
  corn: 'Corn (玉米)',
  soybeans: 'Soybeans (黃豆)',
  wheat: 'Wheat (小麥)',
  coffee: 'Coffee (咖啡)',
  sugar: 'Sugar (糖)',
  cotton: 'Cotton (棉花)',
  natgas: 'Natural Gas (天然氣)',
  wti: 'WTI Crude (原油)',
  gold: 'Gold (黃金)',
  silver: 'Silver (白銀)',
  palladium: 'Palladium (鈀金)',
  usdjpy: 'USD/JPY (美元/日圓)',
};

// Sub-question templates — each is a focused prompt for the specific agent
const SUB_QUESTIONS = {
  fx: (c) => `Provide the current macro/FX framework relevant to ${c}. Cover: DXY trend, Fed/BOJ rate path expectations, real interest rates, and how the current dollar environment creates tailwind or headwind for ${c} prices.`,

  news: (c) => `Scan for recent news and upcoming catalysts affecting ${c}. For each item: classify as Bullish/Bearish, rate impact as HIGH/MEDIUM/LOW, and assess whether it is priced-in or not. Include upcoming event calendar dates.`,

  wasde: (c) => `Analyze the latest USDA WASDE report for ${c}. Provide the supply/demand balance table with current estimate vs last month vs last year. Highlight the month-over-month surprise. Calculate stocks-to-use ratio vs 5-year average. Give bull case and bear case. Rate supply/demand: Very Tight / Tight / Neutral / Loose / Very Loose.`,

  soft: (c) => `Analyze the fundamental supply/demand situation for ${c}. Cover: production estimates by origin, weather conditions in key growing regions, certified stocks trend, seasonal position in crop cycle. Give bull case and bear case. Rate supply/demand: Very Tight / Tight / Neutral / Loose / Very Loose.`,

  energy: (c) => `Analyze the fundamental supply/demand situation for ${c}. For energy: EIA storage, rig counts, OPEC+ policy. For metals: central bank purchases, ETF flows, real rates, industrial demand. Give bull case and bear case. Rate supply/demand: Very Tight / Tight / Neutral / Loose / Very Loose.`,

  cot: (c) => `Provide the latest CFTC COT data for ${c} and all related instruments. Output the FULL table with columns: Instrument | Managed Money Net | MM Net Change (WoW) | MM Percentile (3Y) | Commercial Net | Open Interest | OI Change. Flag any extreme positioning. Assess whether positioning is a headwind or tailwind for a directional trade.`,

  tech: (c) => `Provide technical analysis for ${c}. Start with weekly trend (the primary direction), then daily for tactical entry. Output the key levels table (Support 1/2, Resistance 1/2, Pivot with price and basis). Include RSI, MACD, SMA status. If you have fundamental context from prior analysis, suggest entry strategy aligned with that direction.`,

  quant: (c) => `Quantitative analysis for ${c}: momentum signals (20-day ROC, price vs SMAs), volatility regime (realized vs implied, percentile), seasonal pattern for current month vs 10Y average. Output the composite quant score table (-2 to +2). Include Python code with yfinance.`,
};

// LLM Router prompt for custom question mode
const ROUTER_PROMPT = `You are a task router for a layered commodity analysis system. Given a user's question, determine which specialist agents should be consulted.

Available agents (organized by analysis phase):
Phase 1 (Macro Context):
- fx: Macro/FX framework — DXY, interest rates, dollar impact on commodities

Phase 1 (Catalyst Scan):
- news: Market-moving news, geopolitics, weather, policy, upcoming events

Phase 2 (Fundamentals):
- wasde: USDA supply/demand for grains (corn, soybeans, wheat)
- soft: Soft commodities fundamentals (coffee, sugar, cotton)
- energy: Energy (natural gas, WTI) and precious metals (gold, silver, palladium)

Phase 3 (Positioning & Technicals):
- cot: CFTC positioning data, managed money flows, crowding risk
- tech: Technical analysis, support/resistance, chart patterns, entry levels

Phase 4 (Quant Validation):
- quant: Statistical signals, momentum, volatility, seasonality

RULES:
- Always include fx (macro context is always relevant)
- Always include the correct fundamental agent for the commodity
- Always include cot and tech for actionable analysis
- Include quant for comprehensive analysis
- Do NOT include dario, sam, slacker, or luna

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "agents": ["agent_id_1", "agent_id_2", ...],
  "commodity": "detected commodity name or null",
  "sub_questions": {
    "agent_id_1": "specific question for this agent",
    "agent_id_2": "specific question for this agent"
  }
}`;

module.exports = { COMMODITY_AGENTS, COMMODITY_LABELS, SUB_QUESTIONS, ROUTER_PROMPT };
