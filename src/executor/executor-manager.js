const { GeminiChatManager } = require('../utils/gemini-chat-manager');
const { logger } = require('../utils/logger');

/**
 * ExecutorManager - Manages different CLI executors
 * NO MOCK DATA - PRODUCTION ONLY
 * All executors must be real CLI integrations
 */
class ExecutorManager {
  constructor(executorType = null) {
    // Use explicit type, env variable, or default to gemini
    this.executorType = executorType || process.env.EXECUTOR_CLI || process.env.EXECUTOR_TYPE || 'gemini';

    logger.info(`Initializing ExecutorManager with executor: ${this.executorType}`);

    // Initialize the real executor
    this.executor = this.initializeExecutor();
  }

  /**
   * Initialize the appropriate executor based on type
   * NO MOCK EXECUTORS - ONLY REAL CLI INTEGRATIONS
   */
  initializeExecutor() {
    switch(this.executorType.toLowerCase()) {
      case 'gemini':
        // Real Gemini CLI integration - already working
        logger.info('Using GeminiChatManager as executor');
        return new GeminiChatManager({
          sessionName: 'lexical-executor-gemini'
        });

      case 'claude':
        // TODO: Implement real Claude CLI executor
        logger.warn('Claude CLI executor not yet implemented, falling back to Gemini');
        return new GeminiChatManager({
          sessionName: 'lexical-executor-fallback'
        });

      case 'codex':
        // TODO: Implement real Codex CLI executor
        logger.warn('Codex CLI executor not yet implemented, falling back to Gemini');
        return new GeminiChatManager({
          sessionName: 'lexical-executor-fallback'
        });

      default:
        logger.error(`Unknown executor type: ${this.executorType}, using Gemini`);
        return new GeminiChatManager({
          sessionName: 'lexical-executor-default'
        });
    }
  }

  /**
   * Execute a prompt with the configured executor
   * @param {string} prompt - The task to execute
   * @param {object} options - Optional execution parameters
   * @returns {Promise<string>} - Real executor response
   */
  async execute(prompt, options = {}) {
    try {
      logger.info(`ExecutorManager executing with ${this.executorType}: ${prompt.substring(0, 100)}...`);

      // Use real executor - no mock data
      const result = await this.executor.executeWithContext(prompt);

      logger.info(`ExecutorManager execution completed successfully`);
      return result;
    } catch (error) {
      logger.error(`ExecutorManager execution failed:`, error);
      throw error;
    }
  }

  /**
   * Continue a conversation with feedback
   * For Phase 3 - continuous dialog implementation
   * @param {string} feedback - Feedback from orchestrator
   * @returns {Promise<string>} - Real executor response
   */
  async continueConversation(feedback) {
    try {
      logger.info(`ExecutorManager continuing conversation with feedback`);

      // For now, treat feedback as a new prompt with context
      // TODO: Implement proper conversation continuation
      const continuationPrompt = `Based on the previous response, ${feedback}`;
      return await this.execute(continuationPrompt);
    } catch (error) {
      logger.error(`ExecutorManager conversation continuation failed:`, error);
      throw error;
    }
  }

  /**
   * Save executor context
   */
  async saveContext() {
    if (this.executor && this.executor.saveSession) {
      return await this.executor.saveSession();
    }
    return true;
  }

  /**
   * Resume executor context
   */
  async resumeContext() {
    if (this.executor && this.executor.resumeSession) {
      return await this.executor.resumeSession();
    }
    return true;
  }

  /**
   * Get executor information
   */
  getInfo() {
    return {
      type: this.executorType,
      available: true,
      contextSupport: true,
      continuousDialog: this.executorType === 'gemini' // Currently only Gemini supports this
    };
  }
}

module.exports = ExecutorManager;