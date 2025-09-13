const { spawn } = require('child_process');

class HealthCheck {
  constructor() {
    this.status = {
      gemini: 'unknown',
      claude: 'unknown',
      mcp: 'unknown',
      lastCheck: null
    };
  }

  async checkCLI(command, args = []) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      try {
        const child = spawn(command, [...args, '--version'], {
          stdio: 'pipe'
        });

        child.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code === 0);
        });

        child.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  async checkAll() {
    console.log('Running health checks...');
    
    this.status.gemini = await this.checkCLI('gemini') ? 'healthy' : 'unhealthy';
    console.log(`  Gemini: ${this.status.gemini}`);
    
    this.status.claude = await this.checkCLI('claude') ? 'healthy' : 'unhealthy';
    console.log(`  Claude: ${this.status.claude}`);
    
    this.status.mcp = process.env.MCP_SERVER ? 'healthy' : 'not configured';
    console.log(`  MCP: ${this.status.mcp}`);
    
    this.status.lastCheck = new Date().toISOString();
    return this.status;
  }

  getStatus() {
    return this.status;
  }
}

module.exports = { HealthCheck };
