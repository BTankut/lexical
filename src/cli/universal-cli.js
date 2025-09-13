const EventEmitter = require('events');
const { spawn } = require('child_process');
const { preparePrompt } = require('./templates/prompts');
const claudeConfig = require('./configs/claude');
const geminiConfig = require('./configs/gemini');

const CLI_CONFIGS = {
  claude: claudeConfig,
  gemini: geminiConfig
};

class UniversalCLI extends EventEmitter {
  constructor(config) {
    super();
    this.name = config.name; // 'claude', 'gemini', etc.
    this.command = CLI_CONFIGS[this.name].command;
    this.process = null;
    this.capabilities = CLI_CONFIGS[this.name].capabilities || {};
    this.cache = config.cache; // Reuse existing cache
    this.metrics = config.metrics; // Reuse existing metrics
  }

  async execute(prompt, options = {}) {
    const { role = 'auto', timeout = 300000 } = options;

    // Prepare prompt based on role
    const finalPrompt = preparePrompt(prompt, role, this.name);

    // Use existing cache
    const cached = this.cache?.getCachedResult(finalPrompt);
    if (cached) return cached;

    const startTime = Date.now();
    let success = false;
    let result;

    try {
      // Execute with CLI-specific method
      result = await this.executeInternal(finalPrompt, timeout);
      success = true;
      // Cache result
      this.cache?.setTask({ prompt: finalPrompt }, result);
    } catch (error) {
      result = error;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      // Record metrics
      this.metrics?.recordRequest(duration, success, {
        cli: this.name,
        role
      });
    }

    return result;
  }

  async executeWithRetry(prompt, options = {}, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(prompt, options);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  async executeStreaming(prompt, options = {}, onData = null) {
    const { role = 'auto', timeout = 300000 } = options;
    const finalPrompt = preparePrompt(prompt, role, this.name);
    const config = CLI_CONFIGS[this.name];
    
    return new Promise((resolve, reject) => {
      const args = [...config.spawnArgs];
      if (config.inputMethod === 'args') {
        args.push(finalPrompt);
      }
      
      const env = { ...process.env };
      if (config.envCleanup) {
        config.envCleanup.forEach(key => delete env[key]);
      }
      
      const child = spawn(config.command, args, { env });
      let output = '';
      
      if (config.inputMethod === 'stdin') {
        child.stdin.write(finalPrompt + '\n');
        child.stdin.end();
      }
      
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        if (onData) onData('stdout', text);
        this.emit('data', text);
      });
      
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (onData) onData('stderr', text);
        this.emit('error', text);
      });
      
      child.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Process exited with code ${code}`));
      });
      
      setTimeout(() => {
        child.kill();
        reject(new Error('Streaming timeout'));
      }, timeout);
    });
  }

  async executeInternal(prompt, timeout) {
    const config = CLI_CONFIGS[this.name];

    // Build spawn arguments
    const args = [...config.spawnArgs];
    if (config.inputMethod === 'args') {
      args.push(prompt);
    }

    // Clean environment if needed
    const env = { ...process.env };
    if (config.envCleanup) {
      config.envCleanup.forEach(key => delete env[key]);
    }

    // Spawn process
    this.process = spawn(config.command, args, { env });
    const childProcess = this.process;

    // Handle I/O based on CLI type
    if (config.inputMethod === 'stdin') {
      childProcess.stdin.write(prompt + '\n');
      childProcess.stdin.end();
    }

    // Collect output
    return this.collectOutput(childProcess, timeout);
  }

  collectOutput(childProcess, timeout) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Process timed out after ${timeout}ms`));
      }, timeout);

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // Backward compatibility methods
  async createPlan(request) {
    return this.execute(request, { role: 'plan' });
  }

  async executeTask(task) {
    return this.execute(task.prompt, { role: 'execute' });
  }
}

module.exports = UniversalCLI;