const { logger } = require('../utils/logger.js');
const { TaskCache } = require('../utils/cache.js');
const { getMetrics } = require('../utils/metrics.js');
const UniversalCLI = require('../cli/universal-cli.js');

class Orchestrator {
  constructor(config) {
    this.config = config;
    this.executorType = config.executor?.type || 'gemini';
    this.cache = new TaskCache({
      ttl: config.cacheTTL || 600000, // 10 minutes
      maxSize: config.cacheSize || 50
    });
    this.cache.startCleanupInterval();
    this.metrics = getMetrics();
    this.cli = new UniversalCLI({
      name: this.executorType,
      cache: this.cache,
      metrics: this.metrics
    });
  }

  // No need for planner - Claude Code IS the planner
  async processUserRequest(request) {
    logger.info('Processing request:', request);

    // Step 1: Claude Code (me) creates the plan
    const plan = {
      tasks: [{
        id: 'task_001',
        type: 'code_generation',
        description: 'Execute user request',
        prompt: request
      }]
    };

    // Step 2: Execute via Gemini
    const results = [];
    for (const task of plan.tasks) {
      logger.info(`Executing task ${task.id} with ${this.executorType}`);
      const result = await this.executeWithGemini(task.prompt);
      results.push({
        task,
        result,
        status: result.status === 'failed' ? 'failed' : 'completed'
      });
    }

    // Step 3: Return results
    return {
      summary: `Executed ${results.length} tasks`,
      results
    };
  }

  async executeWithGemini(prompt) {
    try {
      const output = await this.cli.execute(prompt, { role: 'execute' });
      return {
        output: output,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error executing with ${this.executorType}:`, error);
      return {
        error: error.message,
        status: 'failed'
      };
    }
  }

  // Direct executor call for MCP
  async execute(task) {
    logger.info(`Direct execution of task: ${task.prompt}`);
    const result = await this.executeWithGemini(task.prompt);

    if (result.status === 'failed') {
      return {
        taskId: task.id || 'direct',
        status: 'error',
        error: result.error
      };
    }

    return {
      taskId: task.id || 'direct',
      status: 'success',
      result: result
    };
  }
}

module.exports = { Orchestrator };