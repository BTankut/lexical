# Implementation Roadmap

## Overview
Step-by-step implementation plan with actual code changes, test points, and rollback strategies.

## Phase 1: Universal CLI (Day 1-3)

### Day 1: Create Base Structure
```bash
# Create new directories
mkdir -p src/cli
mkdir -p src/cli/configs
mkdir -p src/cli/templates
```

#### Files to Create:
1. `src/cli/universal-cli.js` - Main wrapper class
2. `src/cli/configs/claude.js` - Claude configuration
3. `src/cli/configs/gemini.js` - Gemini configuration
4. `src/cli/templates/prompts.js` - Role-based prompts

#### Implementation Order:
```javascript
// 1. Start with configs
// src/cli/configs/claude.js
module.exports = {
  name: 'claude',
  command: 'claude',
  spawnArgs: ['--print', '--dangerously-skip-permissions'],
  inputMethod: 'stdin',
  capabilities: {
    planning: 0.95,
    execution: 0.85,
    review: 0.90
  }
};

// 2. Create UniversalCLI class
// src/cli/universal-cli.js
class UniversalCLI extends EventEmitter {
  constructor(config) {
    // Implementation from design doc
  }
}

// 3. Test with existing orchestrator
const cli = new UniversalCLI(claudeConfig);
await cli.execute("test prompt", { role: 'plan' });
```

### Day 2: Integrate with Existing Code
```javascript
// Modify orchestrator.js to use UniversalCLI internally
// Keep existing methods for compatibility

class Orchestrator {
  constructor(config) {
    // OLD CODE (keep working)
    this.executorType = config.executor?.type || 'gemini';

    // NEW CODE (add alongside)
    this.universalCLI = new UniversalCLI({
      name: this.executorType,
      ...config
    });
  }

  // Keep old method, use new implementation
  async executeWithGemini(prompt) {
    // Use UniversalCLI internally
    return this.universalCLI.execute(prompt, { role: 'execute' });
  }
}
```

### Day 3: Testing & Validation
```bash
# Test commands
npm run test:universal-cli

# Verification checklist:
✓ Claude works with UniversalCLI
✓ Gemini works with UniversalCLI
✓ Cache still working
✓ Metrics still recorded
✓ Old API still works
```

## Phase 2: Multi-Agent Support (Day 4-6)

### Day 4: Create Agent Registry
```javascript
// src/orchestrator/agent-registry.js
class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  register(name, config) {
    const agent = new UniversalCLI(config);
    this.agents.set(name, agent);
  }
}

// src/orchestrator/multi-agent-orchestrator.js
class MultiAgentOrchestrator extends Orchestrator {
  constructor(config) {
    super(config);
    this.registry = new AgentRegistry();

    // Register all configured agents
    for (const [name, agentConfig] of Object.entries(config.agents || {})) {
      this.registry.register(name, agentConfig);
    }
  }
}
```

### Day 5: Implement Agent Selection
```javascript
// Add to MultiAgentOrchestrator
async executeWithAgent(agentName, prompt, options) {
  const agent = this.registry.getAgent(agentName);
  return agent.execute(prompt, options);
}

async executeAuto(prompt, options) {
  const bestAgent = this.selectBestAgent(prompt, options);
  return this.executeWithAgent(bestAgent, prompt, options);
}

selectBestAgent(prompt, options) {
  // Implementation from design doc
}
```

### Day 6: Parallel Execution
```javascript
async executeParallel(prompt, agents, options) {
  const promises = agents.map(agent =>
    this.executeWithAgent(agent, prompt, options)
  );
  return Promise.all(promises);
}
```

## Phase 3: Workflow System (Day 7-9)

### Day 7: Workflow Engine Core
```bash
mkdir -p src/workflow
mkdir -p config/workflows
```

```javascript
// src/workflow/workflow-engine.js
class WorkflowEngine {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.workflows = new Map();
  }

  async execute(workflowName, input) {
    // Implementation from design doc
  }
}
```

### Day 8: Built-in Workflows
```javascript
// config/workflows/built-in.js
module.exports = {
  'direct': { /* ... */ },
  'plan-execute': { /* ... */ },
  'competitive': { /* ... */ }
};

// Load into engine
engine.loadWorkflows(require('./config/workflows/built-in.js'));
```

### Day 9: Workflow Integration
```javascript
// Update MultiAgentOrchestrator
class MultiAgentOrchestrator {
  constructor(config) {
    // ...
    this.workflowEngine = new WorkflowEngine(this);
  }

  async processUserRequest(request, workflowName) {
    return this.workflowEngine.execute(workflowName, request);
  }
}
```

## Phase 4: MCP Tools Update (Day 10-11)

### Day 10: New MCP Server
```javascript
// src/mcp-servers/universal-mcp-server.js
class UniversalMCPServer {
  registerTools() {
    // New tools
    this.server.setRequestHandler('orchestrate', ...);
    this.server.setRequestHandler('list_workflows', ...);

    // Keep old tools (compatibility)
    this.server.setRequestHandler('execute_code', ...);
  }
}
```

### Day 11: Tool Testing
```javascript
// Test new tools
await mcp.orchestrate({ prompt: "test" });
await mcp.list_workflows();
await mcp.list_agents();

// Verify old tools still work
await mcp.execute_code({ prompt: "test" });
```

## Phase 5: Migration & Cleanup (Day 12-14)

### Day 12: Switch to New System
```javascript
// Update package.json start script
"start": "node src/mcp-servers/universal-mcp-server.js",
"start:legacy": "node src/mcp-servers/gemini-executor-server.js"

// Update imports in existing code
// FROM: const { Orchestrator } = require('./orchestrator');
// TO:   const { MultiAgentOrchestrator } = require('./multi-agent-orchestrator');
```

### Day 13: Performance Testing
```bash
# Benchmark tests
npm run benchmark

# Metrics to verify:
- Response time (should be same or better)
- Cache hit rate (should be maintained)
- Memory usage (should be similar)
- CPU usage (should be similar)
```

### Day 14: Documentation & Cleanup
```bash
# Move old files to legacy folder
mkdir -p src/legacy
mv src/orchestrator/planner.js src/legacy/
mv src/orchestrator/executor.js src/legacy/

# Update documentation
- README.md
- API docs
- Migration guide
```

## Testing Checkpoints

### After Each Phase:
```javascript
// Test suite to run
describe('Phase X Validation', () => {
  test('Old API still works', ...);
  test('New features work', ...);
  test('Cache still functional', ...);
  test('Metrics still collected', ...);
  test('No performance regression', ...);
});
```

## Rollback Plan

### For Each Phase:
```bash
# Git tags for rollback points
git tag phase-1-complete
git tag phase-2-complete
# etc.

# Rollback if needed
git checkout phase-1-complete
npm install
npm start
```

### Feature Flags:
```javascript
// config/features.js
module.exports = {
  useUniversalCLI: process.env.USE_UNIVERSAL_CLI !== 'false',
  useMultiAgent: process.env.USE_MULTI_AGENT === 'true',
  useWorkflows: process.env.USE_WORKFLOWS === 'true'
};

// Usage
if (features.useUniversalCLI) {
  // New code
} else {
  // Old code
}
```

## Success Criteria

### Phase 1 ✓
- [ ] UniversalCLI works with both CLIs
- [ ] No breaking changes
- [ ] Tests pass

### Phase 2 ✓
- [ ] Multiple agents registered
- [ ] Auto-selection works
- [ ] Parallel execution works

### Phase 3 ✓
- [ ] Workflows execute correctly
- [ ] Custom workflows possible
- [ ] Performance acceptable

### Phase 4 ✓
- [ ] New MCP tools work
- [ ] Old tools still work
- [ ] Documentation updated

### Phase 5 ✓
- [ ] Full system migrated
- [ ] All tests pass
- [ ] Performance verified

## Risk Mitigation

1. **Keep old code during transition**
   - Don't delete until fully tested
   - Maintain backward compatibility

2. **Test at each step**
   - Unit tests for new components
   - Integration tests for system
   - Performance benchmarks

3. **Gradual rollout**
   - Feature flags for control
   - Test with small subset first
   - Monitor metrics closely

4. **Communication**
   - Document changes clearly
   - Provide migration guide
   - Support during transition

## Timeline Summary

- **Week 1**: Universal CLI (Day 1-3)
- **Week 2**: Multi-Agent + Workflows (Day 4-9)
- **Week 3**: MCP Tools + Migration (Day 10-14)

Total: **3 weeks** for complete implementation

## Next Steps

1. Review this plan with team
2. Set up development branch
3. Begin Phase 1 implementation
4. Daily progress updates
5. Adjust timeline if needed