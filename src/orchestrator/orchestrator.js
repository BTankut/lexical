const { spawn } = require('child_process');
const { logger } = require('../utils/logger.js');
const { TaskCache } = require('../utils/cache.js');
const { getMetrics } = require('../utils/metrics.js');

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
        status: result.error ? 'failed' : 'completed'
      });
    }

    // Step 3: Return results
    return {
      summary: `Executed ${results.length} tasks`,
      results
    };
  }

  async executeWithGemini(prompt) {
    const startTime = Date.now();

    // Check cache first
    const cachedResult = this.cache.getCachedResult(prompt);
    if (cachedResult) {
      logger.info('Using cached result for prompt');
      this.metrics.recordRequest(Date.now() - startTime, true, {
        taskType: 'code_generation',
        fromCache: true
      });
      return cachedResult;
    }

    return new Promise((resolve, reject) => {
      logger.info(`Calling Gemini with: "${prompt.substring(0, 50)}..."`);

      // Clean environment to avoid duplicate API key warnings
      const cleanEnv = { ...process.env };
      delete cleanEnv.GOOGLE_API_KEY;

      const gemini = spawn('gemini', ['--yolo', prompt], {
        env: cleanEnv
      });

      let output = '';
      let errorOutput = '';

      gemini.stdout.on('data', (data) => {
        output += data.toString();
      });

      gemini.stderr.on('data', (data) => {
        const stderr = data.toString();
        errorOutput += stderr;
      });

      gemini.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0 && output.length > 0) {
          logger.info('Gemini execution successful');
          const result = {
            output: output.trim(),
            status: 'success'
          };
          // Cache the successful result
          this.cache.setTask({ prompt }, result);
          // Record metrics
          this.metrics.recordRequest(duration, true, {
            taskType: 'code_generation',
            executor: 'gemini'
          });
          resolve(result);
        } else if (output.length > 0) {
          // Even with non-zero code, if we have output, use it
          logger.warn(`Gemini exited with code ${code} but has output`);
          const result = {
            output: output.trim(),
            status: 'success'
          };
          // Cache the result
          this.cache.setTask({ prompt }, result);
          // Record metrics
          this.metrics.recordRequest(duration, true, {
            taskType: 'code_generation',
            executor: 'gemini'
          });
          resolve(result);
        } else {
          logger.error('Gemini execution failed:', errorOutput);
          // Record failure metrics
          this.metrics.recordRequest(duration, false, {
            taskType: 'code_generation',
            executor: 'gemini',
            error: errorOutput
          });
          reject(new Error(`Gemini failed: ${errorOutput}`));
        }
      });

      // Timeout protection
      const timeout = setTimeout(() => {
        gemini.kill();
        reject(new Error('Gemini execution timeout'));
      }, 60000);

      gemini.on('exit', () => {
        clearTimeout(timeout);
      });
    });
  }

  // Direct executor call for MCP
  async execute(task) {
    logger.info(`Direct execution of task: ${task.prompt}`);
    try {
      const result = await this.executeWithGemini(task.prompt);
      return {
        taskId: task.id || 'direct',
        status: 'success',
        result
      };
    } catch (error) {
      return {
        taskId: task.id || 'direct',
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = { Orchestrator };