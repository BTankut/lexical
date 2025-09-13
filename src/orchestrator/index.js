// Re-export the main Orchestrator from orchestrator.js
const { Orchestrator } = require('./orchestrator.js');

// Also export other orchestrator variants
const { ResilientOrchestrator } = require('./resilient-orchestrator.js');

// Legacy class for backward compatibility (if needed)
const { PlannerCLI } = require('./planner.js');
const { ExecutorCLI } = require('./executor.js');
const { MessageQueue } = require('./message-queue.js');
const { logger } = require('../utils/logger.js');

class LegacyOrchestrator {
  constructor(config) {
    this.config = config;
    this.planner = new PlannerCLI(config.planner);
    this.executor = new ExecutorCLI(config.executor);
    this.queue = new MessageQueue();
    this.state = {
      session_id: null,
      tasks: [],
      context: {}
    };
  }

  async initialize() {
    try {
      await this.planner.start();
      await this.executor.start();
      logger.info('Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  async processUserRequest(request) {
    logger.info('Processing user request:', request);

    try {
      // Step 1: Send to planner
      const plan = await this.planner.createPlan(request);
      logger.info('Plan created:', plan);

      // Step 2: Execute tasks
      for (const task of plan.tasks) {
        logger.info(`Executing task: ${task.id}`);
        const result = await this.executor.execute(task);

        // Step 3: Validate with planner
        const validation = await this.planner.validateResult(result);

        if (validation.approved) {
          this.state.tasks.push({
            task,
            result,
            status: 'completed'
          });
          logger.info(`Task ${task.id} completed successfully`);
        } else {
          // Retry or adjust
          await this.handleFailure(task, validation);
        }
      }

      // Step 4: Generate final response
      const summary = await this.planner.summarize(this.state.tasks);
      logger.info('Request processing completed');
      return summary;
    } catch (error) {
      logger.error('Error processing request:', error);
      throw error;
    }
  }

  async handleFailure(task, validation) {
    logger.warn(`Task ${task.id} failed validation:`, validation.reason);

    // Implement retry logic
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      logger.info(`Retry attempt ${i + 1} for task ${task.id}`);

      // Get refined task from planner
      const refinedTask = await this.planner.refineTask(task, validation.feedback);
      const result = await this.executor.execute(refinedTask);
      const revalidation = await this.planner.validateResult(result);

      if (revalidation.approved) {
        this.state.tasks.push({
          task: refinedTask,
          result,
          status: 'completed'
        });
        logger.info(`Task ${task.id} succeeded on retry ${i + 1}`);
        return;
      }
    }

    // If all retries fail, mark as failed
    this.state.tasks.push({
      task,
      result: { error: validation.reason },
      status: 'failed'
    });
    logger.error(`Task ${task.id} failed after all retries`);
  }

  async shutdown() {
    logger.info('Shutting down orchestrator');
    await this.planner.stop();
    await this.executor.stop();
    logger.info('Orchestrator shutdown complete');
  }
}

module.exports = {
  Orchestrator,
  ResilientOrchestrator,
  LegacyOrchestrator
};