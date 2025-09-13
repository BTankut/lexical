# API Reference

## JSON Schemas

### 1. Task Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Task",
  "required": ["id", "type", "prompt"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique task identifier",
      "pattern": "^task_[0-9a-f]{8}$"
    },
    "type": {
      "type": "string",
      "enum": [
        "code_generation",
        "code_refactoring",
        "code_analysis",
        "bug_fix",
        "testing",
        "documentation"
      ],
      "description": "Task category"
    },
    "prompt": {
      "type": "string",
      "description": "Detailed task description",
      "minLength": 10,
      "maxLength": 5000
    },
    "context": {
      "type": "object",
      "properties": {
        "files": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Related file paths"
        },
        "language": {
          "type": "string",
          "description": "Programming language"
        },
        "framework": {
          "type": "string",
          "description": "Framework being used"
        },
        "dependencies": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Required dependencies"
        }
      }
    },
    "priority": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    },
    "constraints": {
      "type": "object",
      "properties": {
        "maxTokens": {
          "type": "integer",
          "description": "Maximum tokens for response"
        },
        "timeout": {
          "type": "integer",
          "description": "Timeout in seconds"
        },
        "style": {
          "type": "string",
          "description": "Coding style guide"
        }
      }
    }
  }
}
```

### 2. Plan Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "ExecutionPlan",
  "required": ["plan_id", "tasks", "created_at"],
  "properties": {
    "plan_id": {
      "type": "string",
      "pattern": "^plan_[0-9a-f]{8}$"
    },
    "user_request": {
      "type": "string",
      "description": "Original user request"
    },
    "tasks": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/Task"
      },
      "minItems": 1
    },
    "dependencies": {
      "type": "object",
      "description": "Task dependency graph",
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "estimated_duration": {
      "type": "integer",
      "description": "Estimated completion time in seconds"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "planner_model": {
          "type": "string"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    }
  }
}
```

### 3. Result Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "TaskResult",
  "required": ["task_id", "status", "output"],
  "properties": {
    "task_id": {
      "type": "string",
      "pattern": "^task_[0-9a-f]{8}$"
    },
    "status": {
      "type": "string",
      "enum": ["success", "failure", "partial", "timeout"]
    },
    "output": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string",
          "description": "Generated or modified code"
        },
        "files_created": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "files_modified": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "files_deleted": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "explanation": {
          "type": "string",
          "description": "Explanation of changes"
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "metrics": {
      "type": "object",
      "properties": {
        "execution_time_ms": {
          "type": "integer"
        },
        "tokens_used": {
          "type": "integer"
        },
        "cost_usd": {
          "type": "number"
        },
        "model": {
          "type": "string"
        }
      }
    },
    "error": {
      "type": "object",
      "properties": {
        "code": {
          "type": "string"
        },
        "message": {
          "type": "string"
        },
        "details": {
          "type": "object"
        }
      }
    }
  }
}
```

## CLI Response Formats

### Claude CLI Response

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3169,
  "duration_api_ms": 3147,
  "num_turns": 1,
  "result": "string response content",
  "session_id": "uuid",
  "total_cost_usd": 0.082,
  "usage": {
    "input_tokens": 2,
    "cache_creation_input_tokens": 3458,
    "cache_read_input_tokens": 11357,
    "output_tokens": 4,
    "server_tool_use": {
      "web_search_requests": 0
    }
  },
  "permission_denials": [],
  "uuid": "uuid"
}
```

### Gemini CLI Response

```json
{
  "response": "string response content",
  "stats": {
    "models": {
      "gemini-2.5-pro": {
        "api": {
          "totalRequests": 1,
          "totalErrors": 0,
          "totalLatencyMs": 3234
        },
        "tokens": {
          "prompt": 8670,
          "candidates": 0,
          "total": 8689,
          "cached": 0,
          "thoughts": 19,
          "tool": 0
        }
      }
    },
    "tools": {
      "totalCalls": 0,
      "totalSuccess": 0,
      "totalFail": 0,
      "totalDurationMs": 0,
      "byName": {}
    },
    "files": {
      "totalLinesAdded": 0,
      "totalLinesRemoved": 0
    }
  }
}
```

## MCP Protocol Messages

### Tool Registration

```typescript
interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### Tool Invocation

```typescript
interface ToolInvocation {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}
```

### Tool Response

```typescript
interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    isError?: boolean;
  }>;
}
```

## JavaScript Client SDK

### Basic Usage

```javascript
import { OrchestrationClient } from 'lexical-orchestration';

const client = new OrchestrationClient({
  planner: {
    type: 'claude',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  executor: {
    type: 'gemini',
    apiKey: process.env.GEMINI_API_KEY
  }
});

// Process a request
const result = await client.process({
  request: "Create a React component for a todo list",
  options: {
    language: 'typescript',
    framework: 'react'
  }
});
```

### Advanced Configuration

```javascript
const client = new OrchestrationClient({
  planner: {
    type: 'claude',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
    temperature: 0.7
  },
  executor: {
    type: 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-pro',
    timeout: 60000
  },
  cache: {
    enabled: true,
    ttl: 300000,
    maxSize: 100
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential'
  }
});
```

### Event Handling

```javascript
client.on('task:start', (task) => {
  console.log(`Starting task: ${task.id}`);
});

client.on('task:complete', (task, result) => {
  console.log(`Completed task: ${task.id}`);
});

client.on('task:error', (task, error) => {
  console.error(`Task failed: ${task.id}`, error);
});

client.on('plan:created', (plan) => {
  console.log(`Created plan with ${plan.tasks.length} tasks`);
});
```

### Streaming Responses

```javascript
const stream = await client.stream({
  request: "Refactor this function",
  code: functionCode
});

for await (const chunk of stream) {
  console.log(chunk.content);
}
```

## REST API Endpoints

### POST /orchestrate

Execute an orchestration request.

**Request:**
```json
{
  "request": "User request string",
  "context": {
    "files": ["file1.js"],
    "language": "javascript"
  },
  "options": {
    "stream": false,
    "timeout": 60000
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "tasks_completed": 3,
    "output": "...",
    "files_modified": ["file1.js"],
    "duration_ms": 5234
  }
}
```

### GET /status

Get orchestrator status.

**Response:**
```json
{
  "status": "ready",
  "planner": {
    "status": "connected",
    "model": "claude-3-opus"
  },
  "executor": {
    "status": "connected",
    "model": "gemini-2.5-pro"
  },
  "queue": {
    "pending": 0,
    "processing": 1
  }
}
```

### POST /plan

Create an execution plan without executing.

**Request:**
```json
{
  "request": "Build a REST API for user management"
}
```

**Response:**
```json
{
  "plan_id": "plan_abc123",
  "tasks": [
    {
      "id": "task_001",
      "type": "code_generation",
      "description": "Create user model"
    }
  ],
  "estimated_duration": 120
}
```

### POST /execute/{plan_id}

Execute a specific plan.

**Response:**
```json
{
  "execution_id": "exec_xyz789",
  "status": "running",
  "progress": {
    "completed": 1,
    "total": 5
  }
}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/orchestrate');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    apiKey: 'your-api-key'
  }));
});
```

### Message Types

```typescript
// Request
interface WSRequest {
  type: 'orchestrate' | 'plan' | 'execute';
  id: string;
  payload: any;
}

// Response
interface WSResponse {
  type: 'result' | 'progress' | 'error';
  id: string;
  data: any;
}

// Progress Update
interface ProgressUpdate {
  type: 'progress';
  taskId: string;
  percentage: number;
  message: string;
}
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| E001 | PLANNER_TIMEOUT | Planner request timeout |
| E002 | EXECUTOR_TIMEOUT | Executor request timeout |
| E003 | INVALID_TASK | Task validation failed |
| E004 | RATE_LIMIT | API rate limit exceeded |
| E005 | AUTH_FAILED | Authentication failed |
| E006 | PROCESS_CRASHED | CLI process crashed |
| E007 | JSON_PARSE_ERROR | Failed to parse JSON response |
| E008 | NETWORK_ERROR | Network connection failed |
| E009 | RESOURCE_NOT_FOUND | Required resource not found |
| E010 | PERMISSION_DENIED | Permission denied for operation |

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /orchestrate | 10 | 1 minute |
| /plan | 30 | 1 minute |
| /execute | 20 | 1 minute |
| /status | 100 | 1 minute |
| WebSocket | 50 messages | 1 minute |

## SDK Languages

### Python

```python
from lexical_orchestration import OrchestrationClient

client = OrchestrationClient(
    planner_api_key="...",
    executor_api_key="..."
)

result = client.process("Create a Python function")
```

### Go

```go
import "github.com/lexical/orchestration-go"

client := orchestration.NewClient(
    orchestration.WithPlannerKey("..."),
    orchestration.WithExecutorKey("...")
)

result, err := client.Process("Create a Go function")
```

### TypeScript

```typescript
import { OrchestrationClient } from 'lexical-orchestration';

const client = new OrchestrationClient({
  plannerApiKey: '...',
  executorApiKey: '...'
});

const result = await client.process('Create a TypeScript function');
```