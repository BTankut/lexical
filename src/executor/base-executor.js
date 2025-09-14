/**
 * Base Executor Interface
 * ALL executors MUST implement these methods
 * NO MOCK DATA - PRODUCTION ONLY
 */
class BaseExecutor {
  constructor(config = {}) {
    this.name = config.name || 'base';
    this.workingDirectory = config.workingDirectory || process.cwd();
    this.sessionName = config.sessionName || `lexical-executor-${this.name}`;
  }

  /**
   * Execute a prompt with context
   * MUST be implemented by each executor
   * @param {string} prompt - The task to execute
   * @returns {Promise<string>} - Real CLI response
   */
  async executeWithContext(prompt) {
    throw new Error(`executeWithContext not implemented for ${this.name}`);
  }

  /**
   * Continue a conversation with feedback
   * @param {string} feedback - Feedback from orchestrator
   * @returns {Promise<string>} - Real CLI response
   */
  async continueConversation(feedback) {
    // Default implementation: treat as new prompt with context
    const continuationPrompt = `Based on the previous response, ${feedback}`;
    return await this.executeWithContext(continuationPrompt);
  }

  /**
   * Save executor context/session
   * @returns {Promise<boolean>} - Success status
   */
  async saveSession() {
    // Override if executor supports session saving
    return true;
  }

  /**
   * Resume executor context/session
   * @returns {Promise<boolean>} - Success status
   */
  async resumeSession() {
    // Override if executor supports session resuming
    return true;
  }

  /**
   * Get executor capabilities and info
   * @returns {object} - Executor information
   */
  getInfo() {
    return {
      name: this.name,
      workingDirectory: this.workingDirectory,
      sessionSupport: false,
      continuousDialog: false,
      stdinRequired: false,
      specialFlags: []
    };
  }

  /**
   * Helper: Execute command with timeout
   * @protected
   */
  async executeWithTimeout(child, timeout = 120000) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}

module.exports = BaseExecutor;