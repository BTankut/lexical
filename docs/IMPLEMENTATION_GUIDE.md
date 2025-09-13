# Implementation Guide

## Phase 1: Environment Setup (Day 1)

### 1.1 Install Required CLIs

```bash
# Install Claude Code (if not already installed)
npm install -g claude-code

# Install Gemini CLI (nightly for JSON support)
npm install -g @google/gemini-cli@nightly

# Optional: Install Codex CLI
npm install -g codex-cli

# Verify installations
claude --version
gemini --version
codex --version
```

### 1.2 Configure API Keys

```bash
# Add to ~/.bashrc or ~/.zshrc
export ANTHROPIC_API_KEY="your-claude-api-key"
export GEMINI_API_KEY="your-gemini-api-key"
export OPENAI_API_KEY="your-openai-api-key"  # For Codex
```

### 1.3 Test CLI JSON Outputs

```bash
# Test Claude JSON output
claude --print --output-format=json "say hello"

# Test Gemini JSON output
gemini "say hello" --output-format json

# Test Codex proto mode
echo '{"prompt": "say hello"}' | codex proto
```

## Phase 2: Core Infrastructure (Day 2-3)

### 2.1 Project Structure

```
/Users/btankut/Projects/Lexical-TUI-Claude/
├── src/
│   ├── orchestrator/
│   │   ├── index.js
│   │   ├── planner.js
│   │   ├── executor.js
│   │   └── message-queue.js
│   ├── mcp-servers/
│   │   ├── executor-server.js
│   │   └── planner-server.js
│   ├── utils/
│   │   ├── json-rpc.js
│   │   ├── process-manager.js
│   │   └── logger.js
│   └── config/
│       ├── default.json
│       └── mcp-config.json
├── tests/
├── docs/
└── package.json
```

### 2.2 Initialize Project

```bash
cd /Users/btankut/Projects/Lexical-TUI-Claude
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk
npm install winston  # Logging
npm install joi      # Validation
npm install p-queue  # Queue management

# Dev dependencies
npm install -D jest
npm install -D eslint
npm install -D prettier
```

### 2.3 Basic Orchestrator Implementation

```javascript
// src/orchestrator/index.js
import { PlannerCLI } from './planner.js';
import { ExecutorCLI } from './executor.js';
import { MessageQueue } from './message-queue.js';

export class Orchestrator {
  constructor(config) {
    this.config = config;
    this.planner = new PlannerCLI(config.planner);
    this.executor = new ExecutorCLI(config.executor);
    this.queue = new MessageQueue();
    this.state = {
      session_id: null,
      tasks: [],
      context: {}
    };
  }

  async initialize() {
    await this.planner.start();
    await this.executor.start();
    console.log('Orchestrator initialized');
  }

  async processUserRequest(request) {
    // Step 1: Send to planner
    const plan = await this.planner.createPlan(request);

    // Step 2: Execute tasks
    for (const task of plan.tasks) {
      const result = await this.executor.execute(task);

      // Step 3: Validate with planner
      const validation = await this.planner.validateResult(result);

      if (validation.approved) {
        this.state.tasks.push({
          task,
          result,
          status: 'completed'
        });
      } else {
        // Retry or adjust
        await this.handleFailure(task, validation);
      }
    }

    // Step 4: Generate final response
    return await this.planner.summarize(this.state.tasks);
  }

  async shutdown() {
    await this.planner.stop();
    await this.executor.stop();
  }
}
```

## Phase 3: CLI Process Management (Day 4-5)

### 3.1 Planner CLI Wrapper

```javascript
// src/orchestrator/planner.js
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class PlannerCLI extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.process = null;
    this.buffer = '';
  }

  async start() {
    this.process = spawn('claude', [
      '--print',
      '--output-format=json',
      '--dangerously-skip-permissions'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: this.config.apiKey
      }
    });

    this.process.stdout.on('data', (data) => {
      this.buffer += data.toString();
      this.tryParseBuffer();
    });

    this.process.stderr.on('data', (data) => {
      console.error('Planner error:', data.toString());
    });
  }

  tryParseBuffer() {
    try {
      const lines = this.buffer.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const json = JSON.parse(line);
          this.emit('response', json);
        }
      }
      this.buffer = '';
    } catch (e) {
      // Buffer incomplete, wait for more data
    }
  }

  async createPlan(request) {
    const prompt = `
    Create an execution plan for this request: ${request}
    Return as JSON with structure:
    {
      "tasks": [
        {
          "id": "task_001",
          "type": "code_generation",
          "description": "...",
          "prompt": "..."
        }
      ]
    }
    `;

    return this.sendRequest(prompt);
  }

  async sendRequest(prompt) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      this.once('response', (response) => {
        clearTimeout(timeout);
        resolve(response.result);
      });

      this.process.stdin.write(prompt + '\n');
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}
```

### 3.2 Executor CLI Wrapper

```javascript
// src/orchestrator/executor.js
import { spawn } from 'child_process';

export class ExecutorCLI {
  constructor(config) {
    this.config = config;
    this.process = null;
    this.type = config.type || 'gemini';
  }

  async start() {
    if (this.type === 'gemini') {
      this.process = spawn('gemini', [
        '--output-format', 'json'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GEMINI_API_KEY: this.config.apiKey
        }
      });
    } else if (this.type === 'codex') {
      this.process = spawn('codex', ['proto'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }

    this.setupListeners();
  }

  setupListeners() {
    this.process.stdout.on('data', (data) => {
      this.handleOutput(data);
    });

    this.process.stderr.on('data', (data) => {
      console.error(`Executor error: ${data}`);
    });
  }

  async execute(task) {
    const request = {
      jsonrpc: "2.0",
      method: "execute",
      params: {
        prompt: task.prompt,
        context: task.context
      },
      id: task.id
    };

    return this.sendRequest(request);
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, 60000);

      const handler = (data) => {
        output += data.toString();
        try {
          const response = JSON.parse(output);
          this.process.stdout.removeListener('data', handler);
          clearTimeout(timeout);
          resolve(response);
        } catch (e) {
          // Continue accumulating
        }
      };

      this.process.stdout.on('data', handler);

      if (this.type === 'gemini') {
        this.process.stdin.write(request.params.prompt + '\n');
      } else {
        this.process.stdin.write(JSON.stringify(request) + '\n');
      }
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}
```

## Phase 4: MCP Server Setup (Day 6-7)

### 4.1 Create MCP Server

```javascript
// src/mcp-servers/executor-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Orchestrator } from '../orchestrator/index.js';

async function main() {
  const server = new Server(
    {
      name: 'lexical-orchestrator',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const orchestrator = new Orchestrator({
    planner: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    executor: {
      type: process.env.EXECUTOR_TYPE || 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
    }
  });

  await orchestrator.initialize();

  // Register tools
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'orchestrate',
        description: 'Process user request through planner and executor',
        inputSchema: {
          type: 'object',
          properties: {
            request: { type: 'string' }
          },
          required: ['request']
        }
      }
    ]
  }));

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'orchestrate') {
      const result = await orchestrator.processUserRequest(args.request);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Server running');
}

main().catch(console.error);
```

### 4.2 Configure Claude Code

```json
// src/config/mcp-config.json
{
  "mcpServers": {
    "lexical-orchestrator": {
      "command": "node",
      "args": ["./src/mcp-servers/executor-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "EXECUTOR_TYPE": "gemini"
      }
    }
  }
}
```

## Phase 5: Testing & Integration (Day 8-9)

### 5.1 Unit Tests

```javascript
// tests/orchestrator.test.js
import { Orchestrator } from '../src/orchestrator/index.js';

describe('Orchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator({
      planner: { apiKey: 'test' },
      executor: { type: 'gemini', apiKey: 'test' }
    });
  });

  test('processes simple request', async () => {
    const result = await orchestrator.processUserRequest(
      'Create a hello world function'
    );

    expect(result).toHaveProperty('tasks');
    expect(result.tasks).toHaveLength(1);
  });
});
```

### 5.2 Integration Test

```bash
# Start MCP server
node src/mcp-servers/executor-server.js &

# Test with Claude Code
claude --mcp-config ./src/config/mcp-config.json \
  "Use the orchestrator to create a React component"
```

## Phase 6: Production Setup (Day 10)

### 6.1 Process Management

```javascript
// pm2.config.js
module.exports = {
  apps: [{
    name: 'lexical-orchestrator',
    script: './src/mcp-servers/executor-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY
    }
  }]
};
```

### 6.2 Logging Setup

```javascript
// src/utils/logger.js
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  ],
});
```

### 6.3 Error Recovery

```javascript
// src/orchestrator/resilient-orchestrator.js
export class ResilientOrchestrator extends Orchestrator {
  async processUserRequest(request) {
    const maxRetries = 3;
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await super.processUserRequest(request);
      } catch (error) {
        lastError = error;
        logger.error(`Attempt ${i + 1} failed:`, error);

        // Restart failed components
        if (error.component === 'planner') {
          await this.planner.restart();
        } else if (error.component === 'executor') {
          await this.executor.restart();
        }

        // Exponential backoff
        await this.delay(Math.pow(2, i) * 1000);
      }
    }

    throw lastError;
  }
}
```

## Phase 7: Optimization (Day 11-12)

### 7.1 Response Caching

```javascript
// src/utils/cache.js
export class ResponseCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }
}
```

### 7.2 Performance Monitoring

```javascript
// src/utils/metrics.js
export class Metrics {
  constructor() {
    this.data = {
      requests: 0,
      successes: 0,
      failures: 0,
      latencies: []
    };
  }

  recordRequest(duration, success) {
    this.data.requests++;
    this.data.latencies.push(duration);

    if (success) {
      this.data.successes++;
    } else {
      this.data.failures++;
    }
  }

  getStats() {
    const avg = this.data.latencies.reduce((a, b) => a + b, 0) /
                this.data.latencies.length;

    return {
      ...this.data,
      averageLatency: avg,
      successRate: this.data.successes / this.data.requests
    };
  }
}
```

## Deployment Checklist

- [ ] API keys configured
- [ ] CLIs installed and tested
- [ ] MCP server running
- [ ] Claude Code configured
- [ ] Logging enabled
- [ ] Error handling tested
- [ ] Performance monitoring active
- [ ] Documentation complete
- [ ] Backup strategy in place
- [ ] Security review completed

## Troubleshooting

### Common Issues

1. **JSON Parse Errors**
   - Check CLI versions (use nightly for Gemini)
   - Validate JSON output format
   - Add better error handling

2. **Process Timeout**
   - Increase timeout values
   - Check API rate limits
   - Implement retry logic

3. **MCP Connection Failed**
   - Verify MCP server is running
   - Check Claude Code configuration
   - Review server logs

4. **Memory Leaks**
   - Implement proper cleanup
   - Limit cache sizes
   - Monitor memory usage

## Next Steps

1. Add support for multiple executors
2. Implement web dashboard
3. Add telemetry and analytics
4. Create VS Code extension
5. Build CLI tool for direct access