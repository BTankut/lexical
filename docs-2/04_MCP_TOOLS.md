# MCP Tools Specification

## Current vs New Tools

### Current Tools (Limited)
```javascript
- execute_code    // Fixed to Gemini
- execute_task    // Fixed workflow
```

### New Tools (Flexible)
```javascript
- orchestrate           // Universal orchestration
- orchestrate_workflow  // Specific workflow
- orchestrate_parallel  // Parallel execution
- list_workflows       // Available workflows
- list_agents         // Available agents
- get_capabilities    // Agent capabilities
```

## New Tool Definitions

### 1. orchestrate - Universal Orchestration

```javascript
{
  name: 'orchestrate',
  description: 'Process request with intelligent agent and workflow selection',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The task or request to process'
      },
      preferences: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            enum: ['auto', 'claude', 'gemini'],
            description: 'Preferred agent (auto for automatic selection)'
          },
          workflow: {
            type: 'string',
            enum: ['auto', 'direct', 'plan-execute', 'competitive', 'iterative'],
            description: 'Workflow to use (auto for automatic selection)'
          },
          role: {
            type: 'string',
            enum: ['auto', 'plan', 'execute', 'review'],
            description: 'Role for the agent'
          },
          cache: {
            type: 'boolean',
            default: true,
            description: 'Use cached results if available'
          }
        }
      },
      options: {
        type: 'object',
        properties: {
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds'
          },
          retries: {
            type: 'number',
            description: 'Number of retry attempts'
          },
          parallel: {
            type: 'boolean',
            description: 'Enable parallel execution where possible'
          }
        }
      }
    },
    required: ['prompt']
  }
}

// Example usage:
orchestrate({
  prompt: "Create a React component for user authentication",
  preferences: {
    workflow: 'plan-execute',
    agent: 'auto'
  }
})
```

### 2. orchestrate_workflow - Execute Specific Workflow

```javascript
{
  name: 'orchestrate_workflow',
  description: 'Execute a specific workflow with full control',
  inputSchema: {
    type: 'object',
    properties: {
      workflow: {
        type: 'string',
        description: 'Workflow name or inline workflow definition'
      },
      input: {
        type: 'string',
        description: 'Input for the workflow'
      },
      context: {
        type: 'object',
        description: 'Initial context for workflow execution'
      },
      overrides: {
        type: 'object',
        properties: {
          agents: {
            type: 'object',
            description: 'Override agent selection for specific steps'
          },
          timeouts: {
            type: 'object',
            description: 'Override timeouts for specific steps'
          }
        }
      }
    },
    required: ['workflow', 'input']
  }
}

// Example: Custom workflow
orchestrate_workflow({
  workflow: {
    name: 'custom',
    steps: [
      { agent: 'claude', role: 'plan' },
      { agent: 'gemini', role: 'execute' },
      { agent: 'claude', role: 'review' }
    ]
  },
  input: "Build a REST API"
})
```

### 3. orchestrate_parallel - Parallel Execution

```javascript
{
  name: 'orchestrate_parallel',
  description: 'Execute task with multiple agents in parallel',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Task to execute'
      },
      agents: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Agents to use (empty for all available)'
      },
      mode: {
        type: 'string',
        enum: ['race', 'all', 'vote', 'merge'],
        description: 'How to handle parallel results'
      },
      role: {
        type: 'string',
        description: 'Role for all agents'
      }
    },
    required: ['prompt']
  }
}

// Example: Get best result from multiple agents
orchestrate_parallel({
  prompt: "Optimize this SQL query",
  agents: ['claude', 'gemini'],
  mode: 'vote',
  role: 'execute'
})
```

### 4. list_workflows - Get Available Workflows

```javascript
{
  name: 'list_workflows',
  description: 'List all available workflows and their descriptions',
  inputSchema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'built-in', 'custom'],
        default: 'all'
      },
      detailed: {
        type: 'boolean',
        default: false,
        description: 'Include full workflow definitions'
      }
    }
  }
}

// Response example:
{
  workflows: [
    {
      name: 'plan-execute',
      description: 'Plan with Claude, execute with Gemini',
      steps: 2,
      agents: ['claude', 'gemini']
    },
    {
      name: 'competitive',
      description: 'Multiple agents compete for best result',
      steps: 2,
      agents: ['claude', 'gemini'],
      parallel: true
    }
  ]
}
```

### 5. list_agents - Get Available Agents

```javascript
{
  name: 'list_agents',
  description: 'List all available agents and their capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: 'Filter by role capability'
      },
      includeMetrics: {
        type: 'boolean',
        default: false,
        description: 'Include performance metrics'
      }
    }
  }
}

// Response example:
{
  agents: [
    {
      name: 'claude',
      status: 'available',
      capabilities: {
        planning: 0.95,
        execution: 0.85,
        review: 0.90,
        contextWindow: 200000
      },
      metrics: {
        avgResponseTime: 2500,
        successRate: 0.98,
        totalRequests: 150
      }
    },
    {
      name: 'gemini',
      status: 'available',
      capabilities: {
        planning: 0.85,
        execution: 0.95,
        review: 0.80,
        contextWindow: 1000000
      }
    }
  ]
}
```

### 6. get_capabilities - Query Agent Capabilities

```javascript
{
  name: 'get_capabilities',
  description: 'Get detailed capabilities for task matching',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Task description for capability matching'
      },
      requirements: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            description: 'Programming language requirement'
          },
          contextSize: {
            type: 'number',
            description: 'Required context window size'
          },
          role: {
            type: 'string',
            description: 'Required role'
          }
        }
      }
    }
  }
}

// Response: Agents ranked by capability match
{
  recommendations: [
    {
      agent: 'gemini',
      score: 0.95,
      reasons: ['Best execution capability', 'Supports Python'],
      warnings: []
    },
    {
      agent: 'claude',
      score: 0.85,
      reasons: ['Good execution capability'],
      warnings: ['Lower context window than required']
    }
  ]
}
```

## Backward Compatibility

Keep existing tools working during migration:

```javascript
// Map old tools to new implementation
const toolMappings = {
  'execute_code': (args) => orchestrate({
    prompt: args.prompt,
    preferences: {
      agent: 'gemini',
      role: 'execute',
      workflow: 'direct'
    }
  }),

  'execute_task': (args) => orchestrate({
    prompt: args.task.prompt,
    preferences: {
      workflow: 'plan-execute'
    },
    context: { taskId: args.task.id }
  })
};
```

## MCP Server Update

```javascript
// src/mcp-servers/universal-mcp-server.js
class UniversalMCPServer {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.server = new Server({
      name: 'lexical',
      version: '2.0.0'
    });

    this.registerTools();
  }

  registerTools() {
    // New flexible tools
    this.server.setRequestHandler('orchestrate', this.handleOrchestrate.bind(this));
    this.server.setRequestHandler('orchestrate_workflow', this.handleWorkflow.bind(this));
    this.server.setRequestHandler('orchestrate_parallel', this.handleParallel.bind(this));
    this.server.setRequestHandler('list_workflows', this.handleListWorkflows.bind(this));
    this.server.setRequestHandler('list_agents', this.handleListAgents.bind(this));
    this.server.setRequestHandler('get_capabilities', this.handleGetCapabilities.bind(this));

    // Legacy tools (backward compatibility)
    this.server.setRequestHandler('execute_code', this.handleLegacyExecute.bind(this));
    this.server.setRequestHandler('execute_task', this.handleLegacyTask.bind(this));
  }

  async handleOrchestrate(request) {
    const { prompt, preferences = {}, options = {} } = request.params;

    // Auto-select workflow if not specified
    const workflow = preferences.workflow ||
                    this.orchestrator.selectWorkflow(prompt);

    // Execute with selected workflow
    const result = await this.orchestrator.processUserRequest(prompt, {
      workflow,
      agent: preferences.agent,
      role: preferences.role,
      ...options
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }],
      metadata: {
        workflow: workflow,
        agents: result.agents,
        cached: result.fromCache || false,
        duration: result.duration
      }
    };
  }
}
```

## Usage Examples

### Claude Code using new tools:

```javascript
// Simple execution
mcp.orchestrate({
  prompt: "Write a Python web scraper"
});

// Specific workflow
mcp.orchestrate_workflow({
  workflow: 'code-review',
  input: "Create a secure login system"
});

// Parallel comparison
mcp.orchestrate_parallel({
  prompt: "Solve this algorithm problem",
  agents: ['claude', 'gemini'],
  mode: 'all'
});

// Query capabilities
const caps = await mcp.get_capabilities({
  task: "Process 1MB of text data",
  requirements: {
    contextSize: 1000000
  }
});
```

## Benefits

1. **Full Control** - Users can specify every aspect
2. **Auto Mode** - System can decide best approach
3. **Transparency** - Users can see available options
4. **Flexibility** - Mix and match agents/workflows
5. **Discovery** - Query system capabilities

## Testing

1. **Tool validation** - Schema compliance
2. **Integration tests** - Each tool with orchestrator
3. **Compatibility tests** - Old tools still work
4. **Performance tests** - Tool overhead
5. **User tests** - Usability and discovery