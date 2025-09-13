# MCP (Model Context Protocol) Integration Guide

## Overview

MCP enables standardized communication between Claude Code and executor LLMs, providing tool discovery, bi-directional messaging, and session management.

## MCP Server Setup

### 1. Executor MCP Server

Create an MCP server that wraps Gemini/Codex CLI:

```javascript
// executor-mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';

class ExecutorMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'lexical-executor',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
    this.executorProcess = null;
  }

  setupHandlers() {
    // Tool: Execute Code Task
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'execute_code',
          description: 'Execute a coding task using Gemini/Codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              language: { type: 'string' },
              context: { type: 'object' }
            },
            required: ['prompt']
          }
        },
        {
          name: 'validate_code',
          description: 'Validate code syntax and logic',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              language: { type: 'string' }
            },
            required: ['code']
          }
        }
      ]
    }));

    // Tool execution handler
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute_code':
          return await this.executeCode(args);
        case 'validate_code':
          return await this.validateCode(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async executeCode(args) {
    const { prompt, language, context } = args;

    // Start or reuse executor process
    if (!this.executorProcess) {
      this.executorProcess = spawn('gemini', [
        '--output-format', 'json'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }

    // Send prompt and get response
    const response = await this.sendToExecutor(prompt);

    return {
      content: [
        {
          type: 'text',
          text: response.result
        }
      ]
    };
  }

  async sendToExecutor(prompt) {
    return new Promise((resolve, reject) => {
      let output = '';

      const onData = (data) => {
        output += data.toString();
        try {
          const json = JSON.parse(output);
          this.executorProcess.stdout.removeListener('data', onData);
          resolve(json);
        } catch (e) {
          // Continue accumulating data
        }
      };

      this.executorProcess.stdout.on('data', onData);
      this.executorProcess.stdin.write(prompt + '\n');

      setTimeout(() => {
        this.executorProcess.stdout.removeListener('data', onData);
        reject(new Error('Executor timeout'));
      }, 30000);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server started');
  }
}

// Start server
const server = new ExecutorMCPServer();
server.start().catch(console.error);
```

### 2. Claude Code Configuration

Configure Claude Code to use the MCP server:

```json
// claude_code_config.json
{
  "mcpServers": {
    "lexical-executor": {
      "command": "node",
      "args": ["/path/to/executor-mcp-server.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "EXECUTOR_TYPE": "gemini"
      }
    }
  }
}
```

Or via command line:

```bash
claude --mcp-config '[{
  "name": "lexical-executor",
  "command": "node",
  "args": ["./executor-mcp-server.js"]
}]'
```

## Advanced MCP Features

### 1. Resource Provider

Provide context and files to Claude:

```javascript
// Resource: Project Files
this.server.setRequestHandler('resources/list', async () => ({
  resources: [
    {
      uri: 'file:///project/src',
      name: 'Project Source',
      description: 'Source code files',
      mimeType: 'text/plain'
    }
  ]
}));

this.server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;
  const content = await fs.readFile(uri.replace('file://', ''), 'utf-8');

  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: content
      }
    ]
  };
});
```

### 2. Prompts Registry

Define reusable prompts:

```javascript
this.server.setRequestHandler('prompts/list', async () => ({
  prompts: [
    {
      name: 'refactor_code',
      description: 'Refactor code for better readability',
      arguments: [
        {
          name: 'code',
          description: 'Code to refactor',
          required: true
        }
      ]
    }
  ]
}));

this.server.setRequestHandler('prompts/get', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'refactor_code') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Refactor this code:\n${args.code}`
          }
        }
      ]
    };
  }
});
```

### 3. Sampling Support

Handle Claude's sampling requests:

```javascript
this.server.setRequestHandler('sampling/createMessage', async (request) => {
  const { messages, modelPreferences } = request.params;

  // Forward to executor
  const executorResponse = await this.executeWithModel(
    messages,
    modelPreferences
  );

  return {
    role: 'assistant',
    content: {
      type: 'text',
      text: executorResponse
    }
  };
});
```

## Multiple Executor Support

```javascript
class MultiExecutorMCP {
  constructor() {
    this.executors = {
      gemini: new GeminiExecutor(),
      codex: new CodexExecutor(),
      local: new LocalModelExecutor()
    };
  }

  async routeTask(task) {
    // Route based on task type
    if (task.type === 'code_generation') {
      return this.executors.gemini.execute(task);
    } else if (task.type === 'code_review') {
      return this.executors.codex.execute(task);
    } else {
      return this.executors.local.execute(task);
    }
  }
}
```

## State Management

```javascript
class StatefulMCPServer {
  constructor() {
    this.sessions = new Map();
  }

  async handleRequest(request) {
    const sessionId = request.params.sessionId || 'default';

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        history: [],
        context: {},
        executor: this.createExecutor()
      });
    }

    const session = this.sessions.get(sessionId);
    // Process request with session context
  }
}
```

## Error Handling

```javascript
this.server.setRequestHandler('tools/call', async (request) => {
  try {
    return await this.executeWithRetry(request);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
          isError: true
        }
      ]
    };
  }
});

async executeWithRetry(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.execute(request);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await this.delay(Math.pow(2, i) * 1000);
    }
  }
}
```

## Testing MCP Server

### 1. Direct Testing

```bash
# Test with echo
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node executor-mcp-server.js

# Test with Claude Code
claude --mcp-config ./mcp-config.json "test the executor"
```

### 2. Unit Tests

```javascript
// test/mcp-server.test.js
import { ExecutorMCPServer } from '../executor-mcp-server.js';

describe('MCP Server', () => {
  let server;

  beforeEach(() => {
    server = new ExecutorMCPServer();
  });

  test('lists available tools', async () => {
    const response = await server.handleRequest({
      method: 'tools/list'
    });

    expect(response.tools).toContainEqual(
      expect.objectContaining({
        name: 'execute_code'
      })
    );
  });

  test('executes code task', async () => {
    const response = await server.handleRequest({
      method: 'tools/call',
      params: {
        name: 'execute_code',
        arguments: {
          prompt: 'Create a hello world function'
        }
      }
    });

    expect(response.content[0].text).toContain('function');
  });
});
```

## Performance Optimization

### 1. Connection Pooling

```javascript
class ExecutorPool {
  constructor(size = 3) {
    this.pool = [];
    this.available = [];

    for (let i = 0; i < size; i++) {
      const executor = this.createExecutor();
      this.pool.push(executor);
      this.available.push(executor);
    }
  }

  async acquire() {
    if (this.available.length === 0) {
      await this.waitForAvailable();
    }
    return this.available.pop();
  }

  release(executor) {
    this.available.push(executor);
  }
}
```

### 2. Response Caching

```javascript
class CachedMCPServer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async execute(prompt) {
    const cacheKey = this.hashPrompt(prompt);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.response;
      }
    }

    const response = await this.executorProcess(prompt);
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });

    return response;
  }
}
```

## Monitoring and Logging

```javascript
class MonitoredMCPServer {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      latency: []
    };
  }

  async handleRequest(request) {
    const start = Date.now();
    this.metrics.requests++;

    try {
      const response = await this.process(request);
      this.metrics.latency.push(Date.now() - start);
      return response;
    } catch (error) {
      this.metrics.errors++;
      this.logError(error, request);
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgLatency: this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
    };
  }
}
```

## Security Configuration

```javascript
// Secure MCP server with validation
class SecureMCPServer {
  constructor() {
    this.allowedMethods = new Set([
      'tools/list',
      'tools/call',
      'resources/list'
    ]);
  }

  async handleRequest(request) {
    // Validate method
    if (!this.allowedMethods.has(request.method)) {
      throw new Error(`Method not allowed: ${request.method}`);
    }

    // Validate parameters
    this.validateParams(request.params);

    // Sanitize inputs
    const sanitized = this.sanitizeInputs(request.params);

    return await this.process(sanitized);
  }

  validateParams(params) {
    // JSON schema validation
    // Input length checks
    // Type validation
  }

  sanitizeInputs(params) {
    // Remove dangerous characters
    // Escape special sequences
    // Validate file paths
  }
}
```