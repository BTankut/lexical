# 🛠️ MCP Tools Guide - Simplified Architecture

## 📋 Core Tools (9 Essential Tools)

### 1. **orchestrate** ⭐ (Primary Tool)
**Purpose:** Universal task orchestration with intelligent agent and workflow selection
**When to use:** For any task - it automatically selects the best approach
**Features:**
- Auto-detects workflow needs (direct vs plan-execute)
- Auto-selects best agent (Claude for planning/review, Gemini for execution)
- Handles special queries (e.g., "list agents" or "list workflows")

**Example:**
```javascript
mcp__lexical-universal__orchestrate({
  prompt: "Create a REST API with authentication",
  preferences: {
    agent: "auto",      // or 'claude', 'gemini'
    workflow: "auto",   // or 'direct', 'plan-execute'
    role: "execute"     // or 'plan', 'review'
  }
})
```

### 2. **orchestrate_parallel**
**Purpose:** Execute tasks with multiple agents simultaneously
**When to use:** When you want to compare results or get faster responses
**Modes:**
- `race`: First successful result wins
- `all`: Get all results
- `vote`: Most common result wins

**Example:**
```javascript
mcp__lexical-universal__orchestrate_parallel({
  prompt: "Optimize this SQL query",
  agents: ["claude", "gemini"],
  mode: "race"
})
```

### 3. **save_chat_session**
**Purpose:** Persist Gemini chat context for continuity
**When to use:** After completing important tasks to preserve context
**Returns:** `true` on success

### 4. **resume_chat_session**
**Purpose:** Restore previous Gemini chat context
**When to use:** Before starting related tasks to maintain context
**Returns:** `true` on success

### 5. **get_process_stats**
**Purpose:** Monitor system health and active processes
**When to use:** To check CPU usage and manage running processes
**Returns:** Process list with warnings and system health status

### 6. **get_capabilities**
**Purpose:** Get agent recommendations for specific tasks
**When to use:** When you need to know which agent is best for a task
**Example:**
```javascript
mcp__lexical-universal__get_capabilities({
  task: "Process 1MB of text",
  requirements: {
    contextSize: 1000000,
    role: "execute"
  }
})
```

### 7. **orchestrate_workflow**
**Purpose:** Execute specific workflow patterns
**When to use:** When you need fine control over execution flow
**Example:**
```javascript
mcp__lexical-universal__orchestrate_workflow({
  workflow: "plan-execute",
  input: "Build a todo app",
  context: { language: "Python" }
})
```

### 8. **list_workflows**
**Purpose:** List available workflow patterns
**When to use:** To discover available execution patterns
**Note:** Can also be accessed via `orchestrate({ prompt: "list workflows" })`

### 9. **list_agents**
**Purpose:** List available agents and their status
**When to use:** To see which agents are available
**Note:** Can also be accessed via `orchestrate({ prompt: "list agents" })`

## 🎯 Usage Patterns

### Simple Tasks
```javascript
// Let the system decide everything
orchestrate({ prompt: "Write a factorial function" })
```

### Complex Tasks
```javascript
// Force plan-execute workflow
orchestrate({
  prompt: "Design a microservices architecture",
  preferences: { workflow: "plan-execute" }
})
```

### Comparison Tasks
```javascript
// Get solutions from multiple agents
orchestrate_parallel({
  prompt: "Solve this algorithm problem",
  agents: ["claude", "gemini"],
  mode: "all"
})
```

### Context-Aware Tasks
```javascript
// Resume context, execute, then save
resume_chat_session()
orchestrate({ prompt: "Continue implementing the feature" })
save_chat_session()
```

## 🔄 Workflow Types

1. **direct**: Single-step execution
2. **plan-execute**: Plan first, then execute
3. **auto**: System chooses based on complexity

## 🤖 Available Agents

1. **claude**: Best for planning, review, complex reasoning
2. **gemini**: Best for code execution, quick tasks
3. **auto**: System selects based on task requirements

## 📊 Agent Selection Logic

The system automatically selects agents based on:
- **Claude selected when:**
  - Task contains "plan", "design", "architect"
  - Task contains "review", "improve"
  - Role is explicitly "plan"

- **Gemini selected when:**
  - Task is execution-focused
  - Quick response needed
  - Role is "execute"

## 💡 Best Practices

1. **Use `orchestrate` for most tasks** - It's the smartest tool
2. **Save sessions after important work** - Preserves context
3. **Use parallel for comparison** - Great for getting multiple perspectives
4. **Monitor processes regularly** - Use get_process_stats to check health
5. **Let auto mode work** - The system is good at choosing

## 🚀 Quick Reference

| Tool | Primary Use | Key Feature |
|------|------------|-------------|
| orchestrate | Everything | Auto-selects best approach |
| orchestrate_parallel | Comparison | Multiple agents at once |
| save/resume_chat_session | Context | Maintains conversation state |
| get_process_stats | Monitoring | System health check |
| get_capabilities | Discovery | Find best agent for task |

## 📝 Notes

- Legacy tools (execute_code, execute_task) have been removed - use `orchestrate` instead
- The system is optimized for Gemini execution with Claude planning when needed
- All tools support context persistence through the session management system
- Process monitoring runs continuously to prevent CPU overload