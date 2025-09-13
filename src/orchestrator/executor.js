const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { logger } = require('../utils/logger.js');

class ExecutorCLI extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.process = null;
    this.type = config.type || 'gemini';
    this.buffer = '';
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.isReady = false;
    this.responseTimeout = config.timeout || 30000;
  }

  async start() {
    logger.info(`Starting REAL ${this.type} CLI`);

    try {
      if (this.type === 'gemini') {
        // Gemini doesn't need to be started in advance
        // We'll spawn it per request with the prompt as argument
        this.isReady = true;
        logger.info('Gemini CLI ready (will spawn per request)');
        return;
      } else if (this.type === 'claude') {
        // REAL Claude CLI as executor
        this.process = spawn('claude', [
          '--print',
          '--dangerously-skip-permissions'
        ], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        throw new Error(`Unsupported executor type: ${this.type}`);
      }

      this.setupListeners();

      // Wait for process to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.isReady = true;
      logger.info(`${this.type} CLI ready for REAL execution`);
    } catch (error) {
      logger.error(`Failed to start executor:`, error);
      throw error;
    }
  }

  setupListeners() {
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug('Executor stdout:', output.substring(0, 100) + '...');
      this.buffer += output;
      this.processBuffer();
    });

    this.process.stderr.on('data', (data) => {
      const error = data.toString();
      // Gemini outputs some info to stderr, not all are errors
      if (error.includes('error') || error.includes('Error')) {
        logger.error(`Executor stderr:`, error);
      } else {
        logger.debug(`Executor stderr:`, error);
      }
    });

    this.process.on('error', (error) => {
      logger.error('Executor process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        logger.warn(`Executor process exited with code ${code}`);
      }
      this.emit('exit', code);
      this.isReady = false;
    });
  }

  processBuffer() {
    // Check if we have a complete response
    if (this.pendingRequests.size > 0) {
      const [id, handler] = this.pendingRequests.entries().next().value;

      // For Gemini: Look for completion patterns
      // Gemini usually ends with a newline after the response
      if (this.type === 'gemini') {
        // Check if buffer has stabilized (no new data for 500ms)
        if (!this.bufferTimer) {
          this.bufferTimer = setTimeout(() => {
            if (this.buffer.trim().length > 0) {
              this.pendingRequests.delete(id);
              handler.resolve({
                output: this.buffer.trim(),
                status: 'success'
              });
              this.buffer = '';
              this.bufferTimer = null;
            }
          }, 500);
        }
      } else if (this.type === 'claude') {
        // Claude with --print outputs everything and exits
        // Wait for a complete response
        if (this.buffer.includes('\n\n') || this.buffer.length > 100) {
          this.pendingRequests.delete(id);
          handler.resolve({
            output: this.buffer.trim(),
            status: 'success'
          });
          this.buffer = '';
        }
      }
    }
  }

  async execute(task) {
    logger.info(`REAL execution of task ${task.id}: ${task.description}`);
    logger.info(`Sending prompt to ${this.type}: "${task.prompt.substring(0, 50)}..."`);

    try {
      // Send REAL prompt to CLI and get REAL response
      const response = await this.sendRequest(task.prompt);

      logger.info(`Received REAL response from ${this.type}`);

      const result = {
        taskId: task.id,
        status: 'success',
        result: {
          output: response.output,
          type: 'code',
          language: this.detectLanguage(response.output)
        }
      };

      return result;
    } catch (error) {
      logger.error(`Failed to execute task ${task.id}:`, error);
      return {
        taskId: task.id,
        status: 'error',
        error: error.message
      };
    }
  }

  detectLanguage(output) {
    if (output.includes('def ') || output.includes('import ')) return 'python';
    if (output.includes('function ') || output.includes('const ')) return 'javascript';
    if (output.includes('public class') || output.includes('public static')) return 'java';
    return 'text';
  }

  async sendRequest(prompt) {
    // For Gemini, spawn a new process with prompt as argument
    if (this.type === 'gemini') {
      return new Promise((resolve, reject) => {
        logger.info(`Spawning Gemini with prompt: "${prompt.substring(0, 50)}..."`);

        const geminiProcess = spawn('gemini', [prompt]);

        let output = '';
        let errorOutput = '';

        geminiProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        geminiProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        geminiProcess.on('close', (code) => {
          if (code === 0 && output.length > 0) {
            logger.info('Gemini response received');
            resolve({ output: output.trim(), status: 'success' });
          } else {
            logger.error('Gemini failed:', errorOutput);
            reject(new Error(`Gemini failed with code ${code}: ${errorOutput}`));
          }
        });

        const timeout = setTimeout(() => {
          geminiProcess.kill();
          reject(new Error('Gemini timeout'));
        }, this.responseTimeout);

        geminiProcess.on('exit', () => {
          clearTimeout(timeout);
        });
      });
    }

    // For other CLIs, use the existing approach
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      logger.info(`Sending request ${id} to ${this.type} CLI`);

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        logger.error(`Request ${id} timed out after ${this.responseTimeout}ms`);
        reject(new Error(`Request timeout after ${this.responseTimeout}ms`));
      }, this.responseTimeout);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          clearTimeout(this.bufferTimer);
          this.bufferTimer = null;
          logger.info(`Request ${id} completed successfully`);
          resolve(response);
        },
        reject
      });

      // Clear any existing buffer
      this.buffer = '';

      // Send the ACTUAL prompt to the CLI
      logger.debug(`Writing to ${this.type} stdin: ${prompt.substring(0, 50)}...`);
      this.process.stdin.write(prompt + '\n');
    });
  }

  async stop() {
    if (this.process) {
      logger.info(`Stopping ${this.type} CLI`);

      // Try graceful shutdown first
      this.process.stdin.end();

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
    logger.info(`Restarting ${this.type} CLI`);
    await this.stop();
    await this.start();
  }
}

module.exports = { ExecutorCLI };