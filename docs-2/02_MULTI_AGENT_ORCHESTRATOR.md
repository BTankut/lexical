# Multi-Agent Orchestrator Architecture

## Current vs Target Architecture

### Current (Fixed Roles)
```
Orchestrator
  ├── planner (Claude only)
  └── executor (Gemini only)
```

### Target (Flexible Agents)
```
Orchestrator
  ├── agents
  │   ├── claude (any role)
  │   └── gemini (any role)
  ├── workflows
  └── selector
```

## New Orchestrator Design

### Core Structure

```javascript
// src/orchestrator/multi-agent-orchestrator.js
class MultiAgentOrchestrator extends Orchestrator {
  constructor(config) {
    super(config);

    // Initialize agents registry
    this.agents = new Map();
    this.initializeAgents(config.agents);

    // Keep existing systems
    this.cache = this.cache;        // Existing cache
    this.metrics = this.metrics;    // Existing metrics

    // New: workflow engine
    this.workflowEngine = new WorkflowEngine(this);
  }

  initializeAgents(agentConfigs) {
    for (const [name, config] of Object.entries(agentConfigs)) {
      const agent = new UniversalCLI({
        name,
        ...config,
        cache: this.cache,
        metrics: this.metrics
      });
      this.agents.set(name, agent);
    }
  }
}
```

## Agent Management

### 1. Agent Registry

```javascript
class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.capabilities = new Map();
  }

  register(name, agent, capabilities) {
    this.agents.set(name, agent);
    this.capabilities.set(name, capabilities);
  }

  getAgent(name) {
    return this.agents.get(name);
  }

  selectBestAgent(requirements) {
    // Score each agent based on requirements
    const scores = [];

    for (const [name, caps] of this.capabilities) {
      const score = this.calculateScore(caps, requirements);
      scores.push({ name, score });
    }

    // Return best agent
    scores.sort((a, b) => b.score - a.score);
    return this.agents.get(scores[0].name);
  }

  calculateScore(capabilities, requirements) {
    let score = 0;

    // Role capability
    if (requirements.role && capabilities[requirements.role]) {
      score += capabilities[requirements.role] * 10;
    }

    // Language preference
    if (requirements.language && capabilities.languages?.includes(requirements.language)) {
      score += 5;
    }

    // Context size requirement
    if (requirements.contextSize && capabilities.contextWindow >= requirements.contextSize) {
      score += 3;
    }

    return score;
  }
}
```

### 2. Execution Methods

```javascript
class MultiAgentOrchestrator {
  // Single agent execution
  async executeWithAgent(agentName, prompt, options = {}) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const startTime = Date.now();

    try {
      const result = await agent.execute(prompt, options);

      // Metrics are already recorded in UniversalCLI

      return result;
    } catch (error) {
      this.metrics.recordRequest(Date.now() - startTime, false, {
        agent: agentName,
        error: error.message
      });
      throw error;
    }
  }

  // Parallel execution
  async executeParallel(prompt, agentNames, options = {}) {
    const promises = agentNames.map(name =>
      this.executeWithAgent(name, prompt, options)
        .catch(err => ({ error: err.message, agent: name }))
    );

    const results = await Promise.all(promises);

    // Return all results or select best
    if (options.mode === 'all') {
      return results;
    } else if (options.mode === 'race') {
      // Return first successful
      return results.find(r => !r.error) || results[0];
    } else if (options.mode === 'vote') {
      // Return most common result
      return this.selectByVoting(results);
    }
  }

  // Auto-select agent
  async executeAuto(prompt, options = {}) {
    const requirements = this.analyzeRequirements(prompt, options);
    const agent = this.registry.selectBestAgent(requirements);

    return this.executeWithAgent(agent.name, prompt, options);
  }

  analyzeRequirements(prompt, options) {
    const requirements = {
      role: options.role || 'execute',
      contextSize: prompt.length,
      language: null
    };

    // Detect language preference
    if (prompt.match(/python|py/i)) requirements.language = 'python';
    else if (prompt.match(/javascript|js|node/i)) requirements.language = 'javascript';
    else if (prompt.match(/typescript|ts/i)) requirements.language = 'typescript';

    // Detect complexity
    if (prompt.match(/plan|design|architect/i)) {
      requirements.role = 'plan';
      requirements.complexity = 'high';
    }

    return requirements;
  }
}
```

## Workflow Processing

### Updated processUserRequest

```javascript
async processUserRequest(request, workflowConfig = null) {
  // Use provided workflow or auto-detect
  const workflow = workflowConfig || this.detectWorkflow(request);

  const results = [];
  let context = {};

  for (const step of workflow.steps) {
    const stepResult = await this.executeStep(step, request, context);
    results.push(stepResult);

    // Update context for next step
    context = { ...context, ...stepResult.context };

    // Check if we should continue
    if (stepResult.shouldStop) break;
  }

  return {
    workflow: workflow.name,
    steps: results,
    summary: this.summarizeResults(results)
  };
}

async executeStep(step, request, context) {
  const { agent, role, mode } = step;

  // Prepare prompt with context
  const prompt = this.preparePromptWithContext(request, context, role);

  let result;

  if (agent === 'auto') {
    // Auto-select best agent
    result = await this.executeAuto(prompt, { role });
  } else if (Array.isArray(agent)) {
    // Multiple agents (parallel)
    result = await this.executeParallel(prompt, agent, { mode, role });
  } else {
    // Specific agent
    result = await this.executeWithAgent(agent, prompt, { role });
  }

  return {
    step: step.name,
    agent: agent,
    role,
    result,
    context: this.extractContext(result)
  };
}
```

## Configuration Schema

```javascript
// config/orchestrator.config.js
module.exports = {
  agents: {
    claude: {
      command: 'claude',
      capabilities: {
        planning: 0.95,
        execution: 0.85,
        review: 0.90,
        contextWindow: 200000,
        languages: ['python', 'javascript', 'go']
      }
    },
    gemini: {
      command: 'gemini',
      capabilities: {
        planning: 0.85,
        execution: 0.95,
        review: 0.80,
        contextWindow: 1000000,
        languages: ['python', 'javascript', 'java']
      }
    }
  },

  workflows: {
    'single-agent': {
      steps: [
        { name: 'execute', agent: 'auto', role: 'execute' }
      ]
    },
    'plan-execute': {
      steps: [
        { name: 'plan', agent: 'claude', role: 'plan' },
        { name: 'execute', agent: 'gemini', role: 'execute' }
      ]
    },
    'parallel-execute': {
      steps: [
        {
          name: 'parallel',
          agent: ['claude', 'gemini'],
          role: 'execute',
          mode: 'race'
        }
      ]
    },
    'review-loop': {
      steps: [
        { name: 'execute', agent: 'gemini', role: 'execute' },
        { name: 'review', agent: 'claude', role: 'review' },
        { name: 'refine', agent: 'gemini', role: 'execute' }
      ]
    }
  },

  defaultWorkflow: 'single-agent',

  autoSelect: {
    enabled: true,
    rules: [
      { pattern: /review|improve/i, workflow: 'review-loop' },
      { pattern: /plan|design/i, workflow: 'plan-execute' },
      { contextSize: { min: 50000 }, preferAgent: 'gemini' }
    ]
  }
};
```

## Backward Compatibility

```javascript
class MultiAgentOrchestrator {
  // Keep old methods working
  async createPlan(request) {
    return this.executeWithAgent('claude', request, { role: 'plan' });
  }

  async execute(task) {
    return this.executeWithAgent('gemini', task.prompt, { role: 'execute' });
  }

  // Old processUserRequest still works
  async processUserRequestLegacy(request) {
    // Use old fixed workflow
    const plan = await this.createPlan(request);
    const result = await this.execute(plan);
    return result;
  }
}
```

## Migration Strategy

### Phase 1: Add multi-agent support
- Create MultiAgentOrchestrator extending current Orchestrator
- Add agent registry
- Test with existing workflows

### Phase 2: Enable agent selection
- Implement auto-select logic
- Add parallel execution
- Test performance

### Phase 3: Deprecate old classes
- Mark PlannerCLI and ExecutorCLI as deprecated
- Update documentation
- Provide migration guide

## Benefits

1. **Any agent, any role** - Complete flexibility
2. **Parallel execution** - Better performance
3. **Auto-selection** - Smart agent choice
4. **Workflow customization** - User-defined flows
5. **Backward compatible** - No breaking changes

## Metrics & Monitoring

```javascript
// Enhanced metrics for multi-agent
this.metrics.recordRequest(duration, success, {
  agent: agentName,
  role: role,
  workflow: workflowName,
  cacheHit: fromCache,
  parallel: isParallel
});
```

## Testing Plan

1. **Unit tests** for each agent
2. **Integration tests** for workflows
3. **Performance tests** for parallel execution
4. **Compatibility tests** for old API
5. **Load tests** for multi-agent scenarios