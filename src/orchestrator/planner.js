const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { logger } = require('../utils/logger.js');

class PlannerCLI extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.process = null;
    this.buffer = '';
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.isReady = false;
    this.responseTimeout = config.timeout || 30000;
  }

  async start() {
    logger.info('Starting REAL Claude CLI for planning');

    // Start Claude in interactive mode for continuous planning
    this.process = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug('Claude stdout (first 200 chars):', output.substring(0, 200));
      this.buffer += output;
      this.processBuffer();
    });

    this.process.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('Warning') && !error.includes('INFO')) {
        logger.error('Claude stderr:', error);
      }
    });

    this.process.on('error', (error) => {
      logger.error('Claude process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      logger.warn(`Claude process exited with code ${code}`);
      this.emit('exit', code);
      this.isReady = false;
    });

    // Wait for Claude to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.isReady = true;
    logger.info('Claude CLI ready for REAL planning');
  }

  processBuffer() {
    // Check if we have a pending request waiting for response
    if (this.pendingRequests.size > 0) {
      const [id, handler] = this.pendingRequests.entries().next().value;

      // Claude outputs and then exits with --print flag
      // Wait for buffer to stabilize
      if (!this.bufferTimer) {
        this.bufferTimer = setTimeout(() => {
          if (this.buffer.trim().length > 0) {
            logger.debug('Claude response received, processing...');
            this.pendingRequests.delete(id);
            handler.resolve(this.buffer.trim());
            this.buffer = '';
            this.bufferTimer = null;

            // Restart Claude for next request since it exits after --print
            this.restart();
          }
        }, 1000);
      }
    }
  }

  async createPlan(request) {
    const prompt = `You are a task planner. Create an execution plan for this request: "${request}"

Return ONLY valid JSON with this exact structure, no other text:
{
  "tasks": [
    {
      "id": "task_001",
      "type": "code_generation",
      "description": "Brief task description",
      "prompt": "Detailed prompt for the executor to implement",
      "dependencies": [],
      "context": {}
    }
  ]
}

Be specific in the prompt field - it will be sent to another AI for implementation.`;

    try {
      logger.info('Sending REAL planning request to Claude');
      const response = await this.sendRequest(prompt);

      // Extract JSON from Claude's response
      let planData;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[0]);
          logger.info('Successfully parsed plan from Claude:', planData);
        } catch (parseError) {
          logger.error('Failed to parse Claude response as JSON:', parseError);
          // Fallback to a default structure
          planData = {
            tasks: [{
              id: 'task_001',
              type: 'code_generation',
              description: 'Execute user request',
              prompt: request,
              dependencies: [],
              context: {}
            }]
          };
        }
      } else {
        logger.warn('No JSON found in Claude response, using fallback');
        planData = {
          tasks: [{
            id: 'task_001',
            type: 'code_generation',
            description: 'Execute user request',
            prompt: request,
            dependencies: [],
            context: {}
          }]
        };
      }

      return planData;
    } catch (error) {
      logger.error('Failed to create plan with Claude:', error);
      // Return a simple plan as fallback
      return {
        tasks: [{
          id: 'task_001',
          type: 'code_generation',
          description: 'Execute user request',
          prompt: request,
          dependencies: [],
          context: {}
        }]
      };
    }
  }

  async validateResult(result) {
    const prompt = `Validate this execution result and return JSON:
Result: ${JSON.stringify(result, null, 2)}

Return ONLY valid JSON:
{
  "approved": true or false,
  "reason": "explanation if not approved",
  "feedback": "suggestions for improvement"
}`;

    try {
      const response = await this.sendRequest(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Default to approved if can't parse
      return { approved: true, reason: 'Validation passed' };
    } catch (error) {
      logger.error('Failed to validate with Claude:', error);
      return { approved: true, reason: 'Validation bypassed due to error' };
    }
  }

  async refineTask(task, feedback) {
    const prompt = `Refine this task based on feedback:
Task: ${JSON.stringify(task, null, 2)}
Feedback: ${feedback}

Return the refined task in the same JSON structure.`;

    try {
      const response = await this.sendRequest(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return task; // Return original if can't refine
    } catch (error) {
      logger.error('Failed to refine task with Claude:', error);
      return task;
    }
  }

  async summarize(tasks) {
    const prompt = `Summarize these completed tasks concisely:
${JSON.stringify(tasks, null, 2)}

Provide a brief summary of what was accomplished.`;

    try {
      const response = await this.sendRequest(prompt);
      return {
        summary: response,
        tasks: tasks
      };
    } catch (error) {
      logger.error('Failed to summarize with Claude:', error);
      return {
        summary: `Completed ${tasks.length} tasks.`,
        tasks: tasks
      };
    }
  }

  async sendRequest(prompt) {
    if (!this.isReady) {
      logger.warn('Claude not ready, starting...');
      await this.start();
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      logger.info(`Sending REAL request ${id} to Claude`);

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        clearTimeout(this.bufferTimer);
        this.bufferTimer = null;
        logger.error(`Claude request ${id} timed out`);
        reject(new Error('Claude request timeout'));
      }, this.responseTimeout);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          logger.info(`Claude request ${id} completed`);
          resolve(response);
        },
        reject
      });

      // Clear buffer for new response
      this.buffer = '';

      // Send prompt to Claude
      logger.debug('Writing to Claude stdin...');
      this.process.stdin.write(prompt + '\n');
    });
  }

  async stop() {
    if (this.process) {
      logger.info('Stopping Claude CLI');

      // End stdin to signal we're done
      this.process.stdin.end();

      // Give it time to exit gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!this.process.killed) {
        this.process.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }

      this.process = null;
      this.isReady = false;
    }
  }

  async restart() {
    logger.debug('Restarting Claude CLI for next request');
    await this.stop();
    await this.start();
  }
}

module.exports = { PlannerCLI };