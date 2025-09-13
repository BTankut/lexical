// Re-export the main Orchestrator from orchestrator.js
const { Orchestrator } = require('./orchestrator.js');

// Also export other orchestrator variants
const { ResilientOrchestrator } = require('./resilient-orchestrator.js');
const { MultiAgentOrchestrator } = require('./multi-agent-orchestrator.js');
const { LegacyOrchestrator } = require('./legacy-orchestrator.js');

module.exports = {
  Orchestrator,
  ResilientOrchestrator,
  LegacyOrchestrator,
  MultiAgentOrchestrator
};