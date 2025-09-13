# Universal CLI Wrapper Design

## Current State Analysis

### executor.js (214 lines)
- Handles Claude and Gemini as executors
- Different spawn methods for each CLI
- Hardcoded for execution role only

### planner.js (229 lines)
- Claude-specific implementation
- Hardcoded planning prompts
- JSON response parsing

## New Universal CLI Design

### Core Class Structure

```javascript
// src/cli/universal-cli.js
class UniversalCLI extends EventEmitter {
  constructor(config) {
    this.name = config.name;        // 'claude', 'gemini', etc.
    this.command = config.command;  // CLI command
    this.process = null;
    this.capabilities = config.capabilities || {};
    this.cache = config.cache;      // Reuse existing cache
    this.metrics = config.metrics;  // Reuse existing metrics
  }
}
```

## Implementation Details

### 1. Role-Based Execution

```javascript
async execute(prompt, options = {}) {
  const { role = 'auto', timeout = 30000 } = options;

  // Prepare prompt based on role
  const finalPrompt = this.preparePrompt(prompt, role);

  // Use existing cache
  const cached = this.cache?.getCachedResult(finalPrompt);
  if (cached) return cached;

  // Execute with CLI-specific method
  const result = await this.executeInternal(finalPrompt, timeout);

  // Cache result
  this.cache?.setTask({ prompt: finalPrompt }, result);

  // Record metrics
  this.metrics?.recordRequest(duration, success, {
    cli: this.name,
    role
  });

  return result;
}
```

### 2. CLI-Specific Configurations

```javascript
const CLI_CONFIGS = {
  claude: {
    name: 'claude',
    command: 'claude',
    spawnArgs: ['--print', '--dangerously-skip-permissions'],
    inputMethod: 'stdin',
    outputFormat: 'text',
    capabilities: {
      planning: 0.95,
      execution: 0.85,
      review: 0.90
    }
  },

  gemini: {
    name: 'gemini',
    command: 'gemini',
    spawnArgs: ['--yolo'],
    inputMethod: 'args',  // Prompt as argument
    outputFormat: 'mixed',
    capabilities: {
      planning: 0.85,
      execution: 0.95,
      review: 0.80
    },
    envCleanup: ['GOOGLE_API_KEY'] // Remove duplicates
  }
};
```

### 3. Prompt Templates by Role

```javascript
preparePrompt(prompt, role) {
  const templates = {
    plan: {
      claude: `Create a detailed execution plan for: ${prompt}\nProvide step-by-step tasks as JSON`,
      gemini: `${prompt}\nCreate a structured plan with clear steps`
    },
    execute: {
      claude: `Write code for: ${prompt}\nBe concise and efficient`,
      gemini: prompt  // Gemini doesn't need special formatting
    },
    review: {
      claude: `Review and improve: ${prompt}\nFocus on quality and best practices`,
      gemini: `Review this: ${prompt}`
    }
  };

  // Use template or fallback to original prompt
  return templates[role]?.[this.name] || prompt;
}
```

### 4. Unified Spawn Method

```javascript
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
  const childProcess = spawn(config.command, args, { env });

  // Handle I/O based on CLI type
  if (config.inputMethod === 'stdin') {
    childProcess.stdin.write(prompt + '\n');
    childProcess.stdin.end();
  }

  // Collect output (reuse existing logic)
  return this.collectOutput(childProcess, timeout);
}
```

### 5. Migration Path

#### Step 1: Create universal-cli.js with backward compatibility
```javascript
class UniversalCLI {
  // New universal implementation

  // Backward compatibility methods
  async createPlan(request) {
    return this.execute(request, { role: 'plan' });
  }

  async executeTask(task) {
    return this.execute(task.prompt, { role: 'execute' });
  }
}
```

#### Step 2: Update orchestrator gradually
```javascript
// Phase 1: Use UniversalCLI internally in existing classes
class PlannerCLI extends UniversalCLI {
  constructor(config) {
    super({ ...config, name: 'claude', role: 'plan' });
  }
}

// Phase 2: Direct usage
const planner = new UniversalCLI({ name: 'claude' });
const executor = new UniversalCLI({ name: 'gemini' });
```

#### Step 3: Test both old and new APIs
```javascript
// Old API still works
await planner.createPlan(request);

// New API
await planner.execute(request, { role: 'plan' });
```

## Benefits

1. **Single codebase** for all CLIs
2. **Role flexibility** - any CLI can do any role
3. **Keeps existing systems** - cache, metrics, retry all work
4. **Easy to extend** - just add new CLI_CONFIGS entry
5. **Backward compatible** - gradual migration possible

## Testing Strategy

1. **Unit tests** for each CLI configuration
2. **Integration tests** with real CLIs
3. **Role switching tests** - same CLI different roles
4. **Performance tests** - ensure no regression
5. **Compatibility tests** - old API still works

## Files to Create

```
src/
  cli/
    universal-cli.js       (New - 300 lines estimated)
    configs/
      claude.js           (CLI-specific config)
      gemini.js           (CLI-specific config)
    templates/
      prompts.js          (Role-based prompts)
```

## Files to Modify

```
src/orchestrator/
  orchestrator.js         (Use UniversalCLI)
  planner.js             (Deprecate gradually)
  executor.js            (Deprecate gradually)
```

## Success Metrics

- ✅ Both CLIs work in all roles
- ✅ No performance degradation
- ✅ Cache hit rate maintained
- ✅ Metrics still collected
- ✅ Old API continues working