# JSON-RPC Communication Protocol

## Overview

This document defines the JSON-RPC 2.0 protocol implementation for communication between the Planner (Claude) and Executor (Gemini/Codex) modules.

## Protocol Specification

### Base Format

All messages follow JSON-RPC 2.0 specification:

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {},
  "id": 1
}
```

## Message Types

### 1. Task Execution Request

**From**: Planner → Executor
**Method**: `execute_task`

```json
{
  "jsonrpc": "2.0",
  "method": "execute_task",
  "params": {
    "task_type": "code_generation|refactoring|analysis|testing",
    "prompt": "Detailed task description",
    "context": {
      "files": ["file1.js", "file2.js"],
      "current_directory": "/project/src",
      "dependencies": ["react", "typescript"],
      "constraints": []
    },
    "options": {
      "language": "javascript",
      "framework": "react",
      "style_guide": "airbnb"
    }
  },
  "id": "task_001"
}
```

**Response**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "success",
    "output": {
      "code": "generated code here",
      "explanation": "What was done and why",
      "files_modified": [],
      "files_created": []
    },
    "metadata": {
      "execution_time_ms": 1234,
      "tokens_used": 5678,
      "model": "gemini-2.5-pro"
    }
  },
  "id": "task_001"
}
```

### 2. Planning Request

**From**: Orchestrator → Planner
**Method**: `create_plan`

```json
{
  "jsonrpc": "2.0",
  "method": "create_plan",
  "params": {
    "user_request": "Original user request",
    "current_state": {
      "completed_tasks": [],
      "pending_tasks": [],
      "context": {}
    },
    "constraints": {
      "max_tasks": 10,
      "time_limit_seconds": 300
    }
  },
  "id": "plan_001"
}
```

**Response**:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "plan": {
      "tasks": [
        {
          "id": "task_001",
          "type": "code_generation",
          "description": "Create React component",
          "dependencies": [],
          "priority": 1
        }
      ],
      "estimated_time_seconds": 120,
      "explanation": "Plan rationale"
    }
  },
  "id": "plan_001"
}
```

### 3. Validation Request

**From**: Planner → Executor
**Method**: `validate_code`

```json
{
  "jsonrpc": "2.0",
  "method": "validate_code",
  "params": {
    "code": "code to validate",
    "language": "javascript",
    "rules": ["no-unused-vars", "no-console"]
  },
  "id": "validate_001"
}
```

### 4. Context Update

**From**: Orchestrator → All Modules
**Method**: `update_context`

```json
{
  "jsonrpc": "2.0",
  "method": "update_context",
  "params": {
    "action": "add|remove|modify",
    "context_type": "file|dependency|state",
    "data": {}
  },
  "id": "context_001"
}
```

## Error Handling

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Execution failed",
    "data": {
      "type": "TIMEOUT|PARSE_ERROR|EXECUTION_ERROR",
      "details": "Detailed error information",
      "stack_trace": "...",
      "recovery_suggestions": []
    }
  },
  "id": "task_001"
}
```

### Standard Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid request object |
| -32601 | Method not found | Method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 | Execution timeout | Task execution timeout |
| -32001 | Resource unavailable | Required resource not available |
| -32002 | Rate limit exceeded | API rate limit hit |
| -32003 | Authentication failed | Invalid API credentials |

## Streaming Support

For long-running operations, streaming responses are supported:

### Stream Start

```json
{
  "jsonrpc": "2.0",
  "method": "stream_start",
  "params": {
    "stream_id": "stream_001",
    "task_id": "task_001"
  }
}
```

### Stream Data

```json
{
  "jsonrpc": "2.0",
  "method": "stream_data",
  "params": {
    "stream_id": "stream_001",
    "chunk": "partial output data",
    "sequence": 1
  }
}
```

### Stream End

```json
{
  "jsonrpc": "2.0",
  "method": "stream_end",
  "params": {
    "stream_id": "stream_001",
    "total_chunks": 10
  }
}
```

## Batch Requests

Multiple requests can be sent as an array:

```json
[
  {"jsonrpc": "2.0", "method": "execute_task", "params": {...}, "id": 1},
  {"jsonrpc": "2.0", "method": "validate_code", "params": {...}, "id": 2}
]
```

## Implementation Examples

### Node.js Client

```javascript
class JSONRPCClient {
  constructor(process) {
    this.process = process;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  async request(method, params) {
    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  handleResponse(data) {
    const response = JSON.parse(data);
    if (this.pendingRequests.has(response.id)) {
      const { resolve, reject } = this.pendingRequests.get(response.id);
      if (response.error) {
        reject(response.error);
      } else {
        resolve(response.result);
      }
      this.pendingRequests.delete(response.id);
    }
  }
}
```

### Python Server

```python
import json
import sys

class JSONRPCServer:
    def __init__(self):
        self.methods = {}

    def register_method(self, name, handler):
        self.methods[name] = handler

    def handle_request(self, request_str):
        try:
            request = json.loads(request_str)
            method = request.get('method')
            params = request.get('params', {})
            id = request.get('id')

            if method not in self.methods:
                return self.error_response(id, -32601, "Method not found")

            result = self.methods[method](**params)
            return self.success_response(id, result)

        except json.JSONDecodeError:
            return self.error_response(None, -32700, "Parse error")

    def success_response(self, id, result):
        return json.dumps({
            "jsonrpc": "2.0",
            "result": result,
            "id": id
        })

    def error_response(self, id, code, message):
        return json.dumps({
            "jsonrpc": "2.0",
            "error": {"code": code, "message": message},
            "id": id
        })
```

## Performance Considerations

1. **Message Size**: Keep individual messages under 1MB
2. **Batching**: Batch related requests to reduce overhead
3. **Compression**: Use gzip for large payloads
4. **Timeout**: Default timeout 30s, configurable per request
5. **Retry**: Automatic retry with exponential backoff

## Security

1. **Schema Validation**: All messages validated against JSON schema
2. **Input Sanitization**: Sanitize all user inputs
3. **Rate Limiting**: Implement per-minute request limits
4. **Authentication**: Optional HMAC-SHA256 signature

```json
{
  "jsonrpc": "2.0",
  "method": "execute_task",
  "params": {...},
  "id": 1,
  "auth": {
    "timestamp": 1634567890,
    "signature": "base64_hmac_signature"
  }
}
```

## Monitoring

### Metrics to Track

- Request/response latency
- Error rates by type
- Request volume
- Payload sizes
- Retry counts

### Logging Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "RPC Request",
  "data": {
    "method": "execute_task",
    "id": "task_001",
    "duration_ms": 1234,
    "status": "success"
  }
}
```