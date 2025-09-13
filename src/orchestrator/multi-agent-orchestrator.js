const { Orchestrator } = require('./orchestrator');
const AgentRegistry = require('./agent-registry');
const UniversalCLI = require('../cli/universal-cli');
const { logger } = require('../utils/logger');
const { HealthCheck } = require('../utils/health-check');

class MultiAgentOrchestrator extends Orchestrator {
  constructor(config) {
    super(config);
    this.agentRegistry = new AgentRegistry();
    this.healthCheck = new HealthCheck();
    this.initializeAgents(config);
  }

  initializeAgents(config) {
    // Initialize and register multiple agents
    const claudeCLI = new UniversalCLI({
      name: 'claude',
      cache: this.cache,
      metrics: this.metrics,
    });
    this.agentRegistry.register('claude', claudeCLI, claudeCLI.capabilities);

    const geminiCLI = new UniversalCLI({
      name: 'gemini',
      cache: this.cache,
      metrics: this.metrics,
    });
    this.agentRegistry.register('gemini', geminiCLI, geminiCLI.capabilities);

    // Default to gemini if executorType is not specified
    this.cli = this.agentRegistry.getAgent(this.executorType) || geminiCLI;
  }

  async checkHealth() {
    return this.healthCheck.checkAll();
  }

  async executeWithAgent(agentName, prompt, options = {}) {
    const agent = this.agentRegistry.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found.`);
    }
    logger.info(`Executing with specified agent: ${agentName}`);
    return agent.execute(prompt, options);
  }

  async executeParallel(prompt, agentNames, options = {}) {
    const agents = agentNames.map(name => this.agentRegistry.getAgent(name)).filter(Boolean);
    if (agents.length === 0) {
      throw new Error('No valid agents found for parallel execution.');
    }

    logger.info(`Executing in parallel with agents: ${agentNames.join(', ')}`);

    const promises = agents.map(agent =>
      agent.execute(prompt, options).catch(error => ({
        error: error.message,
        agent: agent.name,
      }))
    );

    return Promise.all(promises);
  }

  async executeAuto(prompt, options = {}) {
    // Simple strategy: use the default agent (from config)
    // More complex logic can be added here to select the best agent dynamically
    const agent = this.cli;
    logger.info(`Executing with auto-selected agent: ${agent.name}`);
    return agent.execute(prompt, options);
  }

  // --- Backward Compatibility ---

  // The original `execute` and `processUserRequest` methods from Orchestrator
  // are inherited and should work as expected, using the default `this.cli` instance.
  // We can add explicit overrides if behavior needs to be modified.

  /**
   * Overriding for clarity, though super.execute would also work if unchanged.
   */
  async execute(task) {
    logger.info(`Executing task with default agent: ${this.cli.name}`);
    // This now uses the default CLI instance set in the constructor
    return super.execute(task);
  }
}

module.exports = { MultiAgentOrchestrator };