const { COMMODITY_AGENTS, SUB_QUESTIONS, ROUTER_PROMPT } = require('../config/commodities');
const { GLOBAL_RESPONSE_STYLE, PROMPTS } = require('../config/prompts');
const { SYNTHESIZER_PROMPT } = require('../config/synthesizer');
const { callClaude } = require('./claude-runner');
const { AGENT_MODELS } = require('../config/models');

// ============================================================
// Layered Analysis Pipeline (powered by Claude CLI / Max subscription)
// Phase 1: Macro + News scan (parallel, no context needed)
// Phase 2: Fundamentals (receives Phase 1 context)
// Phase 3: COT + Tech (parallel, receives Phase 1+2 context)
// Phase 4: Quant overlay (receives all prior context)
// Phase 5: Synthesis
// ============================================================

const AGENT_NAMES = {
  wasde: 'Alice (WASDE)',
  cot: 'Vera (COT)',
  tech: 'Hana (Technical)',
  news: 'Nina (News)',
  quant: 'Max (Quant)',
  soft: 'Leo (Soft Commodities)',
  energy: 'Kai (Energy & Metals)',
  fx: 'Raj (Macro/FX)',
};

// Which agents belong to which phase
const PHASE_ROLES = {
  1: ['fx', 'news'],
  2: ['wasde', 'soft', 'energy'],  // only the relevant one will be used
  3: ['cot', 'tech'],
  4: ['quant'],
};

function getPhase(agentId) {
  for (var p = 1; p <= 4; p++) {
    if (PHASE_ROLES[p].includes(agentId)) return p;
  }
  return 2; // default
}

function buildContextBlock(priorResults) {
  if (!priorResults.length) return '';
  var block = priorResults.map(function (r) {
    return '### ' + r.name + '\n' + r.response;
  }).join('\n\n---\n\n');
  return '\n\n[PRIOR ANALYSIS CONTEXT — use this to inform your analysis, do not repeat it]\n' + block;
}

async function callAgent({ agentId, subQuestion, context }) {
  var system = PROMPTS[agentId];
  if (!system) throw new Error('No prompt for agent: ' + agentId);

  var contextBlock = context ? buildContextBlock(context) : '';
  var userMessage = subQuestion + contextBlock;

  return callClaude({
    systemPrompt: GLOBAL_RESPONSE_STYLE + '\n\n' + system,
    userMessage: userMessage,
    webSearch: true,
    model: AGENT_MODELS[agentId],
  });
}

async function callSynthesizer({ agentResults }) {
  var block = agentResults
    .map(function (r) { return '### ' + r.name + ' (Phase ' + r.phase + ')\n' + r.response; })
    .join('\n\n---\n\n');

  return callClaude({
    systemPrompt: GLOBAL_RESPONSE_STYLE + '\n\n' + SYNTHESIZER_PROMPT,
    userMessage: block,
    webSearch: true,
    model: AGENT_MODELS.synthesizer,
  });
}

// --- Planning ---

async function buildCommodityPlan(commodity) {
  var agents = COMMODITY_AGENTS[commodity];
  if (!agents) return null;

  var plan = agents.map(function (agentId) {
    return {
      agentId: agentId,
      name: AGENT_NAMES[agentId] || agentId,
      phase: getPhase(agentId),
      subQuestion: SUB_QUESTIONS[agentId] ? SUB_QUESTIONS[agentId](commodity) : 'Analyze ' + commodity + '.',
    };
  });

  plan.sort(function (a, b) { return a.phase - b.phase; });
  return { agents: plan, commodity: commodity, source: 'static' };
}

async function buildQuestionPlan(question) {
  var response = await callClaude({
    systemPrompt: ROUTER_PROMPT,
    userMessage: question,
    webSearch: false, // router doesn't need web search
  });

  var parsed;
  try {
    var text = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      agents: ['fx', 'news', 'tech', 'cot'].map(function (id) {
        return { agentId: id, name: AGENT_NAMES[id] || id, phase: getPhase(id), subQuestion: question };
      }).sort(function (a, b) { return a.phase - b.phase; }),
      commodity: null,
      source: 'fallback',
    };
  }

  var plan = (parsed.agents || [])
    .filter(function (id) { return PROMPTS[id] && AGENT_NAMES[id]; })
    .map(function (agentId) {
      return {
        agentId: agentId,
        name: AGENT_NAMES[agentId],
        phase: getPhase(agentId),
        subQuestion: (parsed.sub_questions && parsed.sub_questions[agentId]) || question,
      };
    });

  if (!plan.length) {
    plan = ['fx', 'news'].map(function (id) {
      return { agentId: id, name: AGENT_NAMES[id], phase: getPhase(id), subQuestion: question };
    });
  }

  plan.sort(function (a, b) { return a.phase - b.phase; });
  return { agents: plan, commodity: parsed.commodity || null, source: 'router' };
}

// --- Main Pipeline ---

async function runAnalysis({ mode, commodity, question, onEvent }) {
  // Step 1: Plan
  var plan;
  if (mode === 'commodity') {
    plan = await buildCommodityPlan(commodity);
    if (!plan) {
      onEvent('error', { message: 'Unknown commodity: ' + commodity });
      return;
    }
  } else {
    plan = await buildQuestionPlan(question);
  }

  onEvent('plan', {
    agents: plan.agents.map(function (a) {
      return { agentId: a.agentId, name: a.name, phase: a.phase, subQuestion: a.subQuestion };
    }),
    commodity: plan.commodity,
    source: plan.source,
  });

  // Step 2: Execute phases sequentially, agents within each phase in parallel
  var allResults = [];
  var maxPhase = plan.agents.reduce(function (max, a) { return Math.max(max, a.phase); }, 0);

  for (var phase = 1; phase <= maxPhase; phase++) {
    var phaseAgents = plan.agents.filter(function (a) { return a.phase === phase; });
    if (!phaseAgents.length) continue;

    onEvent('phase_start', { phase: phase, agents: phaseAgents.map(function (a) { return a.agentId; }) });

    var priorContext = allResults.slice(); // snapshot of all prior results

    var phasePromises = phaseAgents.map(function (agent) {
      onEvent('agent_start', { agentId: agent.agentId, name: agent.name, phase: agent.phase });

      return callAgent({
        agentId: agent.agentId,
        subQuestion: agent.subQuestion,
        context: priorContext,
      }).then(function (response) {
        var result = { agentId: agent.agentId, name: agent.name, phase: agent.phase, response: response };
        allResults.push(result);
        onEvent('agent_done', result);
        return result;
      }).catch(function (err) {
        onEvent('agent_error', { agentId: agent.agentId, name: agent.name, phase: agent.phase, error: err.message });
        return null;
      });
    });

    await Promise.all(phasePromises);
  }

  // Step 3: Synthesize
  var successResults = allResults.filter(function (r) { return r !== null; });

  if (!successResults.length) {
    onEvent('error', { message: 'All agents failed. Cannot produce a report.' });
    return;
  }

  onEvent('synthesis_start', {});

  try {
    var report = await callSynthesizer({ agentResults: successResults });
    onEvent('synthesis', { report: report });
  } catch (err) {
    onEvent('error', { message: 'Synthesis failed: ' + err.message });
  }

  onEvent('complete', {});
}

module.exports = { runAnalysis };
