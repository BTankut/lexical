# Test MCP Tools

## Available Tools Test Commands

Run these in a new Claude session to test the orchestrator:

### 1. Test Status Tool
```
Use the status tool from lexical-orchestrator to check the system status
```

### 2. Test Plan Tool
```
Use the plan tool from lexical-orchestrator to create a plan for: "Build a REST API endpoint for user authentication"
```

### 3. Test Execute Tool
```
Use the execute tool from lexical-orchestrator with task: {"id": "test_001", "prompt": "Generate a Python hello world function"}
```

### 4. Test Full Orchestration
```
Use the orchestrate tool from lexical-orchestrator to process: "Create a JavaScript function that validates email addresses"
```

## Expected Results

- **status**: Should return orchestrator state with planner and executor status
- **plan**: Should return a structured task plan
- **execute**: Should return executed task result
- **orchestrate**: Should perform full planning and execution pipeline