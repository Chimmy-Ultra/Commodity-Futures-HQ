const { COMMODITY_AGENTS, SUB_QUESTIONS, ROUTER_PROMPT } = require('../config/commodities');
const { GLOBAL_RESPONSE_STYLE, PROMPTS } = require('../config/prompts');
const { SYNTHESIZER_PROMPT } = require('../config/synthesizer');
const { callClaude } = require('./claude-backend');
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

async function callAgent({ agentId, subQuestion, context, modelOverride }) {
  var system = PROMPTS[agentId];
  if (!system) throw new Error('No prompt for agent: ' + agentId);

  var contextBlock = context ? buildContextBlock(context) : '';
  var userMessage = subQuestion + contextBlock;

  // Resolve model: use override if provided, otherwise default
  var VALID_MODELS = { OPUS: 'claude-opus-4-6', SONNET: 'claude-sonnet-4-6' };
  var model = (modelOverride && VALID_MODELS[modelOverride]) || AGENT_MODELS[agentId];

  return callClaude({
    systemPrompt: GLOBAL_RESPONSE_STYLE + '\n\n' + system,
    userMessage: userMessage,
    webSearch: true,
    model: model,
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

// ============================================================
// DAG-based Workflow Execution (for visual workflow editor)
// ============================================================

async function runWorkflowDAG({ nodes, edges, commodity, question, onEvent }) {
  if (!nodes || !nodes.length) {
    onEvent('error', { message: 'Empty workflow' });
    return;
  }

  // Build adjacency and reverse adjacency
  var inbound = {};  // nodeId → [sourceNodeIds]
  var outbound = {}; // nodeId → [targetNodeIds]
  var nodeMap = {};   // nodeId → node

  nodes.forEach(function (n) {
    inbound[n.id] = [];
    outbound[n.id] = [];
    nodeMap[n.id] = n;
  });
  edges.forEach(function (e) {
    inbound[e.to].push(e.from);
    outbound[e.from].push(e.to);
  });

  // Topological sort → execution levels
  var inDegree = {};
  nodes.forEach(function (n) { inDegree[n.id] = (inbound[n.id] || []).length; });
  var levels = [];
  var remaining = new Set(nodes.map(function (n) { return n.id; }));

  while (remaining.size > 0) {
    var level = [];
    remaining.forEach(function (id) {
      if (inDegree[id] === 0) level.push(id);
    });
    if (level.length === 0) {
      onEvent('error', { message: 'Cycle detected in workflow graph' });
      return;
    }
    levels.push(level);
    level.forEach(function (id) {
      remaining.delete(id);
      (outbound[id] || []).forEach(function (next) { inDegree[next]--; });
    });
  }

  // Execute level by level
  var results = {}; // nodeId → { name, response }
  var agentCount = 0;

  for (var li = 0; li < levels.length; li++) {
    var levelNodes = levels[li];

    var promises = levelNodes.map(function (nodeId) {
      var node = nodeMap[nodeId];
      if (!node) return Promise.resolve();

      // Input nodes — just pass through
      if (node.type === 'commodity_source') {
        results[nodeId] = { name: 'Input', response: 'Commodity: ' + (node.commodity || commodity || 'unknown') };
        return Promise.resolve();
      }
      if (node.type === 'question_input') {
        results[nodeId] = { name: 'Input', response: 'Question: ' + (node.question || question || '') };
        return Promise.resolve();
      }

      // Report output — terminal, no action
      if (node.type === 'report_output') {
        return Promise.resolve();
      }

      // Gather context from all inbound nodes
      var context = [];
      (inbound[nodeId] || []).forEach(function (srcId) {
        if (results[srcId] && results[srcId].response) {
          context.push(results[srcId]);
        }
      });

      // Synthesizer node
      if (node.type === 'synthesizer') {
        onEvent('synthesis_start', { nodeId: nodeId });
        return callSynthesizer({ agentResults: context })
          .then(function (report) {
            results[nodeId] = { name: 'Synthesizer', response: report };
            onEvent('synthesis', { nodeId: nodeId, report: report });
          })
          .catch(function (err) {
            onEvent('agent_error', { nodeId: nodeId, name: 'Synthesizer', error: err.message });
          });
      }

      // Agent node
      if (AGENT_NAMES[node.type]) {
        var agentId = node.type;
        var name = AGENT_NAMES[agentId];
        var subQ = SUB_QUESTIONS[agentId]
          ? SUB_QUESTIONS[agentId](commodity || 'this commodity')
          : 'Analyze ' + (commodity || 'this commodity') + '.';

        onEvent('agent_start', { nodeId: nodeId, agentId: agentId, name: name });
        agentCount++;

        return callAgent({ agentId: agentId, subQuestion: subQ, context: context, modelOverride: node.model })
          .then(function (response) {
            results[nodeId] = { name: name, response: response, agentId: agentId };
            onEvent('agent_done', { nodeId: nodeId, agentId: agentId, name: name, response: response });
          })
          .catch(function (err) {
            onEvent('agent_error', { nodeId: nodeId, agentId: agentId, name: name, error: err.message });
          });
      }

      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  onEvent('complete', {});
}

module.exports = { runAnalysis, runWorkflowDAG };
