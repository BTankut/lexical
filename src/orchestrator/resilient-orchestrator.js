const { LegacyOrchestrator } = require('./legacy-orchestrator.js');
const { logger } = require('../utils/logger.js');

class ResilientOrchestrator extends LegacyOrchestrator {
  constructor(config) {
    super(config);
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async processUserRequest(request) {
    let lastError;

    for (let i = 0; i < this.maxRetries; i++) {
      try {
        logger.info(`Processing request (attempt ${i + 1}/${this.maxRetries})`);
        return await super.processUserRequest(request);
      } catch (error) {
        lastError = error;
        logger.error(`Attempt ${i + 1} failed:`, error);

        // Restart failed components
        if (error.message.includes('planner')) {
          logger.info('Restarting planner...');
          await this.planner.restart();
        } else if (error.message.includes('executor')) {
          logger.info('Restarting executor...');
          await this.executor.restart();
        }

        // Exponential backoff
        const delay = Math.pow(2, i) * this.retryDelay;
        logger.info(`Waiting ${delay}ms before retry...`);
        await this.delay(delay);
      }
    }

    logger.error('All retry attempts failed');
    throw lastError;
  }

  async handleFailure(task, validation) {
    logger.warn(`Task ${task.id} failed validation:`, validation.reason);

    for (let i = 0; i < this.maxRetries; i++) {
      logger.info(`Retry attempt ${i + 1} for task ${task.id}`);

      try {
        // Get refined task from planner
        const refinedTask = await this.planner.refineTask(task, validation.feedback);
        const result = await this.executor.execute(refinedTask);
        const revalidation = await this.planner.validateResult(result);

        if (revalidation.approved) {
          this.state.tasks.push({
            task: refinedTask,
            result,
            status: 'completed',
            retries: i + 1
          });
          logger.info(`Task ${task.id} succeeded on retry ${i + 1}`);
          return;
        }

        validation = revalidation;
      } catch (error) {
        logger.error(`Retry ${i + 1} failed for task ${task.id}:`, error);
      }

      // Wait before next retry
      await this.delay(Math.pow(2, i) * this.retryDelay);
    }

    // If all retries fail, mark as failed
    this.state.tasks.push({
      task,
      result: { error: validation.reason },
      status: 'failed',
      retries: this.maxRetries
    });
    logger.error(`Task ${task.id} failed after all retries`);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck() {
    const health = {
      planner: false,
      executor: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Check planner health
      if (this.planner.process && !this.planner.process.killed) {
        health.planner = true;
      }

      // Check executor health
      if (this.executor.process && !this.executor.process.killed) {
        health.executor = true;
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }

    return health;
  }

  async restart() {
    logger.info('Restarting orchestrator...');
    await this.shutdown();
    await this.initialize();
    logger.info('Orchestrator restarted successfully');
  }
}

module.exports = { ResilientOrchestrator };