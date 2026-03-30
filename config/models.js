// models.js — Central model mapping for all agents and characters
// Uses Claude CLI --model flag. Adjust model strings as needed.

const OPUS = 'claude-opus-4-20250514';
const SONNET = 'claude-sonnet-4-20250514';

const AGENT_MODELS = {
  // === Opus — deep reasoning, synthesis, independence ===
  quant:       OPUS,    // Max: backtesting, contrarian analysis, independent veto
  fx:          OPUS,    // Raj: macro framework, foundation all agents depend on
  synthesizer: OPUS,    // Portfolio manager: weigh conflicts, kill criteria, final call
  luna:        OPUS,    // Luna: nuanced bilingual language teaching

  // === Sonnet — structured data gathering, entertainment ===
  wasde:      SONNET,   // Alice: WASDE data lookup
  news:       SONNET,   // Nina: news search + categorization
  cot:        SONNET,   // Vera: CFTC data table filling
  tech:       SONNET,   // Hana: technical indicator lookup
  soft:       SONNET,   // Leo: soft commodity fundamentals
  energy:     SONNET,   // Kai: energy & metals fundamentals

  // === Entertainment ===
  dario:      SONNET,
  sam:        SONNET,
  slacker:    SONNET,

  // === New characters ===
  intern:     SONNET,   // Ming: intern
  conspiracy: SONNET,   // Wei: conspiracy theorist
  veteran:    SONNET,   // Zhang: retired veteran
  risk:       SONNET,   // Sophie: risk manager
  dev:        SONNET,   // Dev: Python developer
  poker:      SONNET,   // Ace: poker dealer
  claude:     SONNET,   // Claude: general AI assistant
};

module.exports = { AGENT_MODELS, OPUS, SONNET };
