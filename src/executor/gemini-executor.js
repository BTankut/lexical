const { spawn } = require('child_process');
const BaseExecutor = require('./base-executor');
const { logger } = require('../utils/logger');
const SessionManager = require('../utils/session-manager');
const { processMonitor } = require('../utils/process-monitor');

/**
 * Gemini CLI Executor
 * REAL IMPLEMENTATION - NO MOCK DATA
 * Uses actual gemini CLI with session management
 */
class GeminiExecutor extends BaseExecutor {
  constructor(config = {}) {
    super({ ...config, name: 'gemini' });
    this.sessionManager = new SessionManager(this.sessionName);
  }

  /**
   * Execute with Gemini CLI using context
   * @param {string} prompt - The task to execute
   * @returns {Promise<string>} - Real Gemini response
   */
  async executeWithContext(prompt) {
    logger.info(`GeminiExecutor: Executing prompt with context`);

    // Resume session for context
    await this.resumeSession();

    try {
      // Prepare the full prompt with context
      const fullPrompt = prompt;

      // Execute with real Gemini CLI
      const result = await this.executeGeminiCommand(fullPrompt);

      // Save session after execution
      await this.saveSession();

      return result;
    } catch (error) {
      logger.error('GeminiExecutor execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a Gemini CLI command
   * @private
   */
  async executeGeminiCommand(prompt) {
    return new Promise((resolve, reject) => {
      logger.info(`Executing Gemini command: ${prompt.substring(0, 100)}...`);

      // Gemini takes prompt as command line argument
      const child = spawn('gemini', [prompt], {
        cwd: this.workingDirectory,
        env: process.env
      });

      // Register with process monitor
      const pid = child.pid;
      processMonitor.registerProcess(pid, 'gemini');

      let output = '';
      let errorOutput = '';
      let resolved = false;

      // Smart completion detection (from GeminiChatManager)
      const checkCompletion = () => {
        if (!resolved && output.length > 10) {
          const lines = output.split('\n');
          const hasContent = output.trim().length > 0;

          if (
            // Code blocks completed
            (output.includes('```') && output.split('```').length % 2 === 1) ||
            // Multiple lines received
            (lines.length >= 2 && !prompt.includes('...') && hasContent) ||
            // Sentence ended
            (output.match(/[.!?]\s*$/)) ||
            // Function/class definition
            (output.includes('def ') || output.includes('function ') || output.includes('class '))
          ) {
            // Fast response - 200ms timeout
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                processMonitor.unregisterProcess(pid);
                child.kill();
                resolve(output.trim());
              }
            }, 200);
          }
        }
      };

      child.stdout.on('data', (data) => {
        output += data.toString();
        checkCompletion();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Timeout after 2 minutes
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          processMonitor.unregisterProcess(pid);
          child.kill();
          if (output.trim()) {
            resolve(output.trim());
          } else {
            reject(new Error(`Gemini timeout: ${errorOutput}`));
          }
        }
      }, 120000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        processMonitor.unregisterProcess(pid);

        if (!resolved) {
          resolved = true;
          if (code === 0 || output.trim()) {
            logger.info(`Gemini process ${pid} completed successfully`);
            resolve(output.trim());
          } else {
            logger.error(`Gemini process ${pid} failed with code ${code}`);
            reject(new Error(`Gemini failed: ${errorOutput}`));
          }
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        processMonitor.unregisterProcess(pid);
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });
    });
  }

  /**
   * Save Gemini session
   */
  async saveSession() {
    try {
      logger.info(`Saving Gemini session: ${this.sessionName}`);
      await this.executeGeminiCommand(`/chat save ${this.sessionName}`);
      this.sessionManager.saveSession();
      return true;
    } catch (error) {
      logger.warn('Failed to save Gemini session:', error.message);
      return false;
    }
  }

  /**
   * Resume Gemini session
   */
  async resumeSession() {
    try {
      logger.info(`Resuming Gemini session: ${this.sessionName}`);
      await this.executeGeminiCommand(`/chat resume ${this.sessionName}`);
      return true;
    } catch (error) {
      logger.warn('Failed to resume Gemini session:', error.message);
      return false;
    }
  }

  /**
   * Get Gemini executor info
   */
  getInfo() {
    return {
      name: 'gemini',
      workingDirectory: this.workingDirectory,
      sessionSupport: true,
      continuousDialog: true,
      stdinRequired: false,
      specialFlags: [],
      commandFormat: 'gemini "prompt"'
    };
  }
}

module.exports = GeminiExecutor;