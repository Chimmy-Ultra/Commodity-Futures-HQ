/**
 * calendar.js — Economic calendar event definitions
 */

const CALENDAR_EVENTS = [
  { id: 'wasde', name: 'WASDE Report', nameZh: 'WASDE 供需報告', category: 'agriculture', impact: 'high', icon: '\uD83D\uDCCA', description: 'USDA World Agricultural Supply & Demand Estimates' },
  { id: 'crop-progress', name: 'USDA Crop Progress', nameZh: 'USDA 作物進度', category: 'agriculture', impact: 'medium', icon: '\uD83C\uDF3E', description: 'Weekly crop condition and planting/harvest progress' },
  { id: 'usda-export', name: 'USDA Export Sales', nameZh: 'USDA 出口銷售', category: 'agriculture', impact: 'medium', icon: '\uD83D\uDEA2', description: 'Weekly export sales report for agricultural commodities' },
  { id: 'fomc', name: 'FOMC Decision', nameZh: 'FOMC 利率決議', category: 'macro', impact: 'high', icon: '\uD83C\uDFE6', description: 'Federal Reserve interest rate decision and statement' },
  { id: 'nfp', name: 'Non-Farm Payrolls', nameZh: '非農就業', category: 'macro', impact: 'high', icon: '\uD83D\uDC77', description: 'US employment situation report (first Friday of month)' },
  { id: 'cpi', name: 'CPI Report', nameZh: 'CPI 消費者物價', category: 'macro', impact: 'high', icon: '\uD83D\uDCC8', description: 'Consumer Price Index — key inflation measure' },
  { id: 'ppi', name: 'PPI Report', nameZh: 'PPI 生產者物價', category: 'macro', impact: 'medium', icon: '\uD83C\uDFED', description: 'Producer Price Index — wholesale inflation' },
  { id: 'eia-petro', name: 'EIA Petroleum Status', nameZh: 'EIA 原油庫存', category: 'energy', impact: 'high', icon: '\uD83D\uDEE2\uFE0F', description: 'Weekly crude oil inventory and production data' },
  { id: 'eia-gas', name: 'EIA Natural Gas Storage', nameZh: 'EIA 天然氣庫存', category: 'energy', impact: 'medium', icon: '\uD83D\uDD25', description: 'Weekly natural gas storage report' },
  { id: 'opec', name: 'OPEC+ Meeting', nameZh: 'OPEC+ 會議', category: 'energy', impact: 'high', icon: '\u26FD', description: 'OPEC+ production policy decisions' },
  { id: 'cot', name: 'COT Report (CFTC)', nameZh: 'COT 持倉報告', category: 'positioning', impact: 'medium', icon: '\uD83D\uDCCB', description: 'Commitments of Traders — positioning data (released Friday)' },
  { id: 'gdp', name: 'GDP Report', nameZh: 'GDP 國內生產總值', category: 'macro', impact: 'high', icon: '\uD83C\uDFDB\uFE0F', description: 'US Gross Domestic Product (advance/preliminary/final)' },
  { id: 'pce', name: 'PCE Price Index', nameZh: 'PCE 物價指數', category: 'macro', impact: 'high', icon: '\uD83D\uDCB2', description: "Fed's preferred inflation measure" },
];

// Claude prompt for fetching upcoming dates
const CALENDAR_PROMPT = `You are a financial calendar assistant. Given today's date, provide the next 60 days of upcoming dates for the following economic events. For each event, give the EXACT date (YYYY-MM-DD format).

Events to find dates for:
- WASDE Report (USDA, usually around 10th-12th of each month)
- USDA Crop Progress (weekly, Monday afternoons during growing season Apr-Nov)
- USDA Export Sales (weekly, Thursdays)
- FOMC Decision (8 meetings per year, scheduled dates)
- Non-Farm Payrolls (first Friday of each month)
- CPI Report (usually mid-month, around 10th-14th)
- PPI Report (usually day before or after CPI)
- EIA Petroleum Status (weekly, Wednesdays)
- EIA Natural Gas Storage (weekly, Thursdays)
- OPEC+ Meeting (scheduled meetings, roughly every 1-2 months)
- COT Report / CFTC (weekly, Fridays)
- GDP Report (quarterly, advance/preliminary/final estimates)
- PCE Price Index (monthly, usually last week of month)

IMPORTANT: Return ONLY valid JSON array. No markdown, no explanation.
Format: [{"id": "wasde", "date": "2026-04-10"}, {"id": "fomc", "date": "2026-05-06"}, ...]
Include ALL instances of recurring events (e.g., every Wednesday for EIA) for the next 60 days.`;

module.exports = { CALENDAR_EVENTS, CALENDAR_PROMPT };
