const { spawn } = require('child_process');
const { logger } = require('./logger');
const { processMonitor } = require('./process-monitor');

class GeminiChatManager {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.sessionName = 'lexical-mcp-main';
  }

  async executeGeminiCommand(command) {
    return new Promise((resolve, reject) => {
      // Clean environment - remove GOOGLE_API_KEY to avoid conflicts
      const cleanEnv = { ...process.env };
      delete cleanEnv.GOOGLE_API_KEY;

      const child = spawn('gemini', ['--yolo'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv
      });

      // Register process for monitoring
      processMonitor.registerProcess(child.pid, 'gemini-chat', {
        command,
        sessionName: this.sessionName
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;
      let processKilled = false;

      child.stdin.write(command + '\n');
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // console.log removed to avoid breaking MCP protocol
        // Smart completion detection - Gemini output patterns
        const text = data.toString();

        // Smart and fast completion detection
        if (!resolved && stdout.length > 10) {
          // Quick response for simple answers
          const lines = stdout.split('\n');
          const hasContent = stdout.trim().length > 0;

          // Detect various completion patterns
          if (
            // Code blocks completed
            (stdout.includes('```') && stdout.split('```').length % 2 === 1) ||
            // Multiple lines received without ellipsis
            (lines.length >= 2 && !text.includes('...') && hasContent) ||
            // Sentence ended
            (stdout.match(/[.!?]\s*$/)) ||
            // Function/class definition received
            (stdout.includes('def ') || stdout.includes('function ') || stdout.includes('class '))
          ) {
            // Very fast response - 200ms as per GEMINI_MCP_GUIDE
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(stdout.trim());
              }
            }, 200);
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        // console.error removed to avoid breaking MCP protocol
      });

      child.on('close', (code) => {
        processMonitor.unregisterProcess(child.pid);

        if (!resolved) {
          resolved = true;
          if (code === 0) {
            logger.info(`Gemini process ${child.pid} completed successfully`);
            resolve(stdout.trim());
          } else {
            logger.error(`Gemini process ${child.pid} failed with code ${code}: ${stderr}`);
            reject(new Error(`Gemini command failed: ${stderr}`));
          }
        }
      });

      child.on('error', (error) => {
        processMonitor.unregisterProcess(child.pid);
        if (!resolved) {
          resolved = true;
          logger.error(`Gemini process ${child.pid} error:`, error);
          reject(error);
        }
      });

      // Enhanced timeout with better cleanup
      setTimeout(() => {
        if (!resolved && !processKilled) {
          resolved = true;
          processKilled = true;

          logger.warn(`Gemini process ${child.pid} timeout - forcefully terminating`);

          // Try graceful termination first
          child.kill('SIGTERM');

          // Force kill after 5 seconds if still running
          setTimeout(() => {
            if (!child.killed) {
              logger.error(`Force killing Gemini process ${child.pid}`);
              child.kill('SIGKILL');
            }
            processMonitor.unregisterProcess(child.pid);
          }, 5000);

          reject(new Error('Gemini command timeout'));
        }
      }, 180000); // 3 minutes
    });
  }

  async resumeSession() {
    try {
      logger.info(`Resuming chat session: ${this.sessionName}`);
      await this.executeGeminiCommand(`/chat resume ${this.sessionName}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to resume session: ${error.message}`);
      return false;
    }
  }

  async saveSession() {
    try {
      logger.info(`Saving chat session: ${this.sessionName}`);
      this.sessionManager.saveSession();
      return true;
    } catch (error) {
      logger.warn(`Failed to save session: ${error.message}`);
      return false;
    }
  }

  async executeWithContext(prompt) {
    // 1. Resume previous context
    await this.resumeSession();
    
    // 2. Execute actual prompt
    const result = await this.executeGeminiCommand(prompt);
    
    // 3. Save context
    await this.saveSession();
    
    return result;
  }

  async chat(prompt) {
    return this.executeWithContext(prompt);
  }
}

module.exports = { GeminiChatManager };
