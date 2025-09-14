# TUI-Orchestrator / Executor Architecture Implementation Plan

## ⚠️ CRITICAL PRODUCTION REQUIREMENTS

### 🚫 ABSOLUTELY NO MOCK DATA
- **This is a PRODUCTION-READY system**
- **ALL tests MUST use REAL CLI tools**
- **NO hardcoded responses or fake agents**
- **Every feature MUST be tested with REAL-WORLD scenarios**
- **If it doesn't work with real CLIs, it DOESN'T SHIP**

### ✅ Testing Standards
- 100% success rate required before commit
- Real CLI integration tests only
- No simulation, no mocking, no shortcuts
- Test with actual Gemini CLI responses
- Test with actual Claude CLI when integrated
- Verify with real MCP tool executions

---

## 🎯 Core Architecture Concept

### The Reality We're Building
```
┌─────────────────┐
│   USER          │
└────────┬────────┘
         │ Natural Language
         ▼
┌─────────────────┐
│   TUI (CLI)     │ ← Whichever TUI is chosen becomes Orchestrator
│  (Orchestrator) │   Currently: Claude Code CLI
└────────┬────────┘   Future: Gemini CLI, Codex CLI
         │
         │ MCP Tools
         ▼
┌─────────────────┐
│   EXECUTOR      │ ← Different CLI from Orchestrator
│   (CLI)         │   Currently: Gemini CLI
└─────────────────┘   Future: Claude CLI, Codex CLI
```

### Key Principles
1. **TUI = Orchestrator/Planner** (automatic role assignment)
2. **Executor = Different CLI** (never same as orchestrator)
3. **Communication = Natural Language** (via MCP tools)
4. **Continuous Dialog** (not one-shot execution)
5. **Context Preservation** (both sides maintain context)

---

## 📊 Current System Analysis

### What's Working ✅
- Claude Code CLI as TUI/Orchestrator
- MCP tools infrastructure
- GeminiChatManager for execution
- Context persistence (sessions)
- Process monitoring

### What's Broken or Fake ❌
- **Fake agent selection** in orchestrate tool (line 254-263)
- **Hardcoded "claude" and "gemini"** that don't actually do anything
- **UniversalCLI instances** all identical (multi-agent-orchestrator.js:17-36)
- **No executor selection** by user
- **No continuous dialog** mechanism
- **Hardcoded workflows** that don't adapt

---

## 🛠️ Implementation Phases

### Phase 1: Executor Selection Mechanism ⚡ [IMMEDIATE]

#### 1.1 Configuration Update
**File:** `claude_code_config.template.json`
```json
{
  "mcpServers": {
    "lexical-universal": {
      "env": {
        "EXECUTOR_CLI": "gemini",  // NEW: User selects executor
        "EXECUTOR_TYPE": "gemini", // DEPRECATED: Remove later
      }
    }
  }
}
```

#### 1.2 Remove Fake Agent Logic
**File:** `src/mcp-servers/universal-mcp-server.js`
- **DELETE** lines 254-263 (fake agent selection)
- **DELETE** "agent" parameter from orchestrate responses
- **KEEP** workflow selection (it's real and works)

#### 1.3 Create ExecutorManager
**New File:** `src/executor/executor-manager.js`
```javascript
class ExecutorManager {
  constructor(executorType) {
    this.executorType = executorType || process.env.EXECUTOR_CLI || 'gemini';
    this.executor = this.initializeExecutor();
  }

  initializeExecutor() {
    switch(this.executorType) {
      case 'gemini':
        return new GeminiChatManager(); // Existing, working
      case 'claude':
        return new ClaudeCLIExecutor(); // To be created
      case 'codex':
        return new CodexCLIExecutor();  // To be created
      default:
        throw new Error(`Unknown executor: ${this.executorType}`);
    }
  }

  async execute(prompt, options = {}) {
    return this.executor.executeWithContext(prompt);
  }

  async continueConversation(feedback) {
    // For continuous dialog - Phase 3
    return this.executor.continueWithFeedback(feedback);
  }
}
```

### Phase 2: Clean Up Hardcoded Elements 🧹

#### 2.1 Fix MultiAgentOrchestrator
**File:** `src/orchestrator/multi-agent-orchestrator.js`
- **DELETE** fake UniversalCLI instances (lines 17-36)
- **REPLACE** with single ExecutorManager
- **REMOVE** agent registry (it's fake)

#### 2.2 Simplify Orchestrate Tool
**File:** `src/mcp-servers/universal-mcp-server.js`
```javascript
async handleOrchestrate(params) {
  const { prompt, preferences = {} } = params;
  const { workflow = 'auto' } = preferences;

  // Workflow selection stays (it's real)
  let selectedWorkflow = workflow;
  if (workflow === 'auto') {
    if (prompt.match(/plan|design|architect/i)) {
      selectedWorkflow = 'plan-execute';
    } else {
      selectedWorkflow = 'direct';
    }
  }

  // Execute with configured executor (no fake agent selection)
  const result = await this.executorManager.execute(prompt);

  return {
    success: true,
    result: result,
    workflow: selectedWorkflow,
    executor: this.executorManager.executorType // Real executor being used
  };
}
```

### Phase 3: Continuous Dialog Mechanism 🔄

#### 3.1 New MCP Tool: execute_with_feedback
```javascript
{
  name: 'execute_with_feedback',
  description: 'Execute task with continuous feedback until completion',
  inputSchema: {
    type: 'object',
    properties: {
      task: { type: 'string' },
      success_criteria: { type: 'string' },
      max_iterations: { type: 'number', default: 5 }
    }
  }
}
```

#### 3.2 Dialog Loop Implementation
```javascript
async handleExecuteWithFeedback(params) {
  const { task, success_criteria, max_iterations = 5 } = params;
  let iteration = 0;
  let completed = false;
  let result;

  while (!completed && iteration < max_iterations) {
    if (iteration === 0) {
      result = await this.executorManager.execute(task);
    } else {
      // Orchestrator provides feedback
      const feedback = this.evaluateResult(result, success_criteria);
      result = await this.executorManager.continueConversation(feedback);
    }

    completed = this.checkCompletion(result, success_criteria);
    iteration++;
  }

  return {
    success: completed,
    result: result,
    iterations: iteration
  };
}
```

### Phase 4: Real Executor Implementations 🚀

#### 4.1 Claude CLI Executor
**New File:** `src/executor/claude-cli-executor.js`
```javascript
class ClaudeCLIExecutor {
  constructor() {
    this.contextFile = './sessions/claude-executor-context.json';
  }

  async executeWithContext(prompt) {
    // Real Claude CLI integration
    const child = spawn('claude', ['--print']);
    // ... actual implementation
  }
}
```

#### 4.2 Codex CLI Executor
**New File:** `src/executor/codex-cli-executor.js`
```javascript
class CodexCLIExecutor {
  // Similar structure for Codex
}
```

---

## 🧪 Testing Requirements

### MANDATORY Real-World Tests

#### Test 1: Basic Execution
```javascript
// REAL TEST - NO MOCKING
it('should execute real Gemini CLI command', async () => {
  const executor = new ExecutorManager('gemini');
  const result = await executor.execute('Write a hello world function');

  // Verify ACTUAL Gemini response
  expect(result).toContain('def') || expect(result).toContain('function');
  expect(result).not.toBe('MOCK_RESPONSE'); // NEVER
});
```

#### Test 2: Executor Selection
```javascript
// Test with REAL environment variable
process.env.EXECUTOR_CLI = 'gemini';
const executor = new ExecutorManager();
expect(executor.executorType).toBe('gemini');

// Test REAL execution
const result = await executor.execute('What is 2+2?');
expect(result).toContain('4'); // Real response
```

#### Test 3: Continuous Dialog
```javascript
// REAL conversation test
const executor = new ExecutorManager('gemini');
const task = 'Create a Python calculator';
const result1 = await executor.execute(task);

// Real feedback based on actual response
const feedback = 'Add error handling for division by zero';
const result2 = await executor.continueConversation(feedback);

// Verify real improvement
expect(result2).toContain('ZeroDivisionError');
```

#### Test 4: MCP Tool Integration
```bash
# REAL MCP tool test - NO SIMULATION
mcp__lexical-universal__orchestrate({
  prompt: "Create a REST API",
  preferences: { workflow: "direct" }
})

# Must return REAL Gemini-generated code
# Must complete successfully
# Must be runnable code
```

### Test Verification Checklist
- [ ] All tests use REAL CLIs
- [ ] No hardcoded responses
- [ ] No mock data
- [ ] 100% success rate
- [ ] Tests run in CI/CD
- [ ] Results are reproducible
- [ ] Context persistence verified
- [ ] Error handling tested with real errors

---

## 📝 Progress Tracking

### Phase 1 Tasks
- [ ] Update config template with EXECUTOR_CLI
- [ ] Create ExecutorManager class
- [ ] Remove fake agent selection
- [ ] Test with real Gemini CLI
- [ ] Verify backward compatibility

### Phase 2 Tasks
- [ ] Clean MultiAgentOrchestrator
- [ ] Simplify orchestrate tool
- [ ] Remove all hardcoded elements
- [ ] Test simplified system
- [ ] Update documentation

### Phase 3 Tasks
- [ ] Implement execute_with_feedback tool
- [ ] Create dialog loop mechanism
- [ ] Test continuous conversations
- [ ] Verify context preservation
- [ ] Document feedback patterns

### Phase 4 Tasks
- [ ] Implement Claude CLI Executor
- [ ] Implement Codex CLI Executor
- [ ] Test cross-CLI execution
- [ ] Verify no context conflicts
- [ ] Full integration testing

---

## ⚠️ Critical Success Factors

1. **NEVER use mock data** - Production only
2. **ALWAYS test with real CLIs** - No exceptions
3. **MAINTAIN backward compatibility** - Don't break existing
4. **VERIFY each phase** - Before moving to next
5. **DOCUMENT everything** - Clear, detailed, updated

---

## 🎯 End Goal

A production-ready system where:
- Any TUI can be the orchestrator
- Any other CLI can be the executor
- Real continuous dialog happens
- Context is preserved on both sides
- No hardcoded logic exists
- Everything is configurable
- 100% real-world tested

---

**Last Updated:** 2025-01-14
**Status:** Phase 1 COMPLETE ✅
**Next Action:** Phase 2 - Clean up MultiAgentOrchestrator

## ✅ Phase 1 Completion Report

### What Was Implemented:
1. **ExecutorManager class** - Full implementation with real CLI integration
2. **EXECUTOR_CLI config** - Added to template configuration
3. **Removed fake agent selection** - orchestrate tool now uses real executor
4. **100% REAL TESTS PASSED** - No mock data used

### Test Results (REAL WORLD):
- ✅ ExecutorManager initialization: Working
- ✅ Simple math (2+2): Real response "4"
- ✅ Code generation: Real Python factorial function created
- ✅ Context save/resume: Working (with minor warnings)
- ✅ Conversation continuation: Working with feedback

### Files Changed:
- Created: `src/executor/executor-manager.js`
- Updated: `src/mcp-servers/universal-mcp-server.js`
- Updated: `claude_code_config.template.json`
- Created: `docs-3/TUI_ORCHESTRATOR_EXECUTOR_ARCHITECTURE.md`

### Verified With:
- Real Gemini CLI commands
- Real file creation (add.py, factorial.py)
- Real context persistence
- Real multi-turn conversations