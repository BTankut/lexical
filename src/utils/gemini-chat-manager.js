const { spawn } = require('child_process');
const { logger } = require('./logger');

class GeminiChatManager {
  constructor() {
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

      let stdout = '';
      let stderr = '';
      let resolved = false;

      child.stdin.write(command + '\n');
      child.stdin.end();

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        // Smart completion detection - Gemini output patterns
        const text = data.toString();

        // Look for completion signals - NO MORE API KEY DEPENDENCY!
        if (!resolved) {
          // Detect completion by output patterns
          if (stdout.length > 3 && (
            // Look for natural completion patterns
            (stdout.split('\n').length >= 2 && text.trim().length > 0) ||
            // Or substantial response that looks complete
            (stdout.length > 10 && !text.includes('...') && !text.includes('loading'))
          )) {
            // Give minimal time to ensure completion
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(stdout.trim());
              }
            }, 200); // Even faster - 0.2 seconds
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`Gemini command failed: ${stderr}`));
          }
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
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
      await this.executeGeminiCommand(`/chat save ${this.sessionName}`);
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

  async getSettings() {
    try {
      logger.info('Getting Gemini settings');
      const settings = await this.executeGeminiCommand('gemini settings list');
      return settings;
    } catch (error) {
      logger.warn(`Failed to get settings: ${error.message}`);
      return null;
    }
  }
}

module.exports = { GeminiChatManager };
