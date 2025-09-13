# Workflow Configuration System

## Overview
Enable users to define and customize task processing workflows through configuration.

## Workflow Components

### 1. Workflow Definition Schema

```javascript
// Schema for workflow configuration
const WorkflowSchema = {
  name: 'string',           // Workflow identifier
  description: 'string',    // Human-readable description
  version: 'string',        // Version for compatibility

  steps: [{
    name: 'string',         // Step identifier
    agent: 'string|array',  // Agent name(s) or 'auto'
    role: 'string',         // plan|execute|review|auto

    // Optional fields
    condition: 'function',  // When to execute this step
    transform: 'function',  // Transform input before execution
    validate: 'function',   // Validate output
    retry: 'object',        // Retry configuration
    timeout: 'number',      // Step timeout

    // Parallel execution
    parallel: 'boolean',    // Execute agents in parallel
    mode: 'string',         // race|all|vote

    // Flow control
    onSuccess: 'string',    // Next step on success
    onFailure: 'string',    // Next step on failure
    stopOnError: 'boolean'  // Stop workflow on error
  }],

  // Global settings
  settings: {
    maxDuration: 'number',     // Total workflow timeout
    cacheStrategy: 'string',   // none|step|workflow
    metricsLevel: 'string',    // basic|detailed|debug
    errorHandling: 'string'    // stop|continue|retry
  }
};
```

### 2. Built-in Workflows

```javascript
// config/workflows/built-in.js
module.exports = {
  // Simple single-agent execution
  'direct': {
    name: 'direct',
    description: 'Direct execution with auto-selected agent',
    steps: [
      {
        name: 'execute',
        agent: 'auto',
        role: 'auto'
      }
    ]
  },

  // Traditional plan-execute
  'plan-execute': {
    name: 'plan-execute',
    description: 'Plan with Claude, execute with Gemini',
    steps: [
      {
        name: 'planning',
        agent: 'claude',
        role: 'plan',
        transform: (input) => `Create a detailed plan for: ${input}`
      },
      {
        name: 'execution',
        agent: 'gemini',
        role: 'execute',
        transform: (input, context) => {
          // Use plan from previous step
          return `Execute this plan:\n${context.plan}\n\nOriginal request: ${input}`;
        }
      }
    ]
  },

  // Parallel competitive execution
  'competitive': {
    name: 'competitive',
    description: 'Multiple agents compete for best result',
    steps: [
      {
        name: 'parallel-execution',
        agent: ['claude', 'gemini'],
        role: 'execute',
        parallel: true,
        mode: 'all',  // Get all results
        transform: (input) => input
      },
      {
        name: 'select-best',
        agent: 'claude',
        role: 'review',
        transform: (input, context) => {
          const results = context.parallelResults;
          return `Select the best solution from these options:\n${JSON.stringify(results)}`;
        }
      }
    ]
  },

  // Iterative refinement
  'iterative': {
    name: 'iterative',
    description: 'Execute, review, and refine iteratively',
    steps: [
      {
        name: 'initial-execution',
        agent: 'gemini',
        role: 'execute'
      },
      {
        name: 'review',
        agent: 'claude',
        role: 'review',
        transform: (input, context) => {
          return `Review this implementation:\n${context.lastResult}\n\nOriginal request: ${input}`;
        },
        validate: (output) => {
          // Check if review suggests improvements
          return output.includes('perfect') || output.includes('no improvements');
        },
        onSuccess: 'complete',
        onFailure: 'refine'
      },
      {
        name: 'refine',
        agent: 'gemini',
        role: 'execute',
        transform: (input, context) => {
          return `Refine based on feedback:\n${context.review}\n\nOriginal: ${context.lastResult}`;
        },
        onSuccess: 'review'  // Loop back to review
      },
      {
        name: 'complete',
        agent: null,  // No agent, just return result
        transform: (input, context) => context.lastResult
      }
    ],
    settings: {
      maxIterations: 3  // Prevent infinite loops
    }
  },

  // Specialized workflows
  'code-review': {
    name: 'code-review',
    description: 'Generate code and review it',
    steps: [
      {
        name: 'generate',
        agent: 'gemini',
        role: 'execute'
      },
      {
        name: 'security-review',
        agent: 'claude',
        role: 'review',
        transform: (input, context) =>
          `Review for security issues:\n${context.code}`
      },
      {
        name: 'performance-review',
        agent: 'claude',
        role: 'review',
        transform: (input, context) =>
          `Review for performance:\n${context.code}`
      },
      {
        name: 'apply-fixes',
        agent: 'gemini',
        role: 'execute',
        condition: (context) => context.issues?.length > 0,
        transform: (input, context) =>
          `Fix these issues:\n${context.issues}\n\nIn code:\n${context.code}`
      }
    ]
  }
};
```

### 3. Workflow Engine Implementation

```javascript
// src/workflow/workflow-engine.js
class WorkflowEngine {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.workflows = new Map();
    this.loadBuiltinWorkflows();
  }

  async execute(workflowName, input, initialContext = {}) {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow ${workflowName} not found`);
    }

    const execution = {
      id: generateId(),
      workflow: workflowName,
      startTime: Date.now(),
      input,
      context: { ...initialContext },
      steps: [],
      status: 'running'
    };

    try {
      // Execute workflow steps
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];

        // Check condition
        if (step.condition && !step.condition(execution.context)) {
          continue;  // Skip this step
        }

        // Execute step
        const stepResult = await this.executeStep(step, input, execution);
        execution.steps.push(stepResult);

        // Update context
        execution.context = { ...execution.context, ...stepResult.output };

        // Handle flow control
        if (stepResult.status === 'failed' && step.stopOnError) {
          execution.status = 'failed';
          break;
        }

        // Navigate to next step based on result
        if (stepResult.status === 'success' && step.onSuccess) {
          i = this.findStepIndex(workflow, step.onSuccess) - 1;
        } else if (stepResult.status === 'failed' && step.onFailure) {
          i = this.findStepIndex(workflow, step.onFailure) - 1;
        }

        // Check max iterations
        if (workflow.settings?.maxIterations) {
          const loopCount = execution.steps.filter(s => s.name === step.name).length;
          if (loopCount >= workflow.settings.maxIterations) {
            break;
          }
        }
      }

      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      return execution;

    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;
      throw error;
    }
  }

  async executeStep(step, input, execution) {
    const startTime = Date.now();

    try {
      // Transform input if needed
      const transformedInput = step.transform
        ? step.transform(input, execution.context)
        : input;

      // Execute with appropriate agent(s)
      let result;
      if (step.parallel && Array.isArray(step.agent)) {
        result = await this.orchestrator.executeParallel(
          transformedInput,
          step.agent,
          { role: step.role, mode: step.mode }
        );
      } else if (step.agent === 'auto') {
        result = await this.orchestrator.executeAuto(
          transformedInput,
          { role: step.role }
        );
      } else if (step.agent) {
        result = await this.orchestrator.executeWithAgent(
          step.agent,
          transformedInput,
          { role: step.role, timeout: step.timeout }
        );
      } else {
        // No agent - just transform and return
        result = { output: transformedInput };
      }

      // Validate output if needed
      if (step.validate && !step.validate(result)) {
        throw new Error('Step validation failed');
      }

      return {
        name: step.name,
        status: 'success',
        agent: step.agent,
        role: step.role,
        duration: Date.now() - startTime,
        output: result
      };

    } catch (error) {
      // Handle retry logic
      if (step.retry?.attempts > 0) {
        return this.retryStep(step, input, execution, error);
      }

      return {
        name: step.name,
        status: 'failed',
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async retryStep(step, input, execution, lastError) {
    const retryConfig = step.retry;
    let lastAttemptError = lastError;

    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      // Wait before retry
      await this.delay(retryConfig.delay * Math.pow(2, attempt - 1));

      try {
        return await this.executeStep(
          { ...step, retry: null },  // Prevent recursive retry
          input,
          execution
        );
      } catch (error) {
        lastAttemptError = error;
      }
    }

    throw lastAttemptError;
  }
}
```

### 4. Dynamic Workflow Creation

```javascript
// Allow users to create custom workflows
class WorkflowBuilder {
  constructor() {
    this.workflow = {
      name: '',
      steps: [],
      settings: {}
    };
  }

  name(name) {
    this.workflow.name = name;
    return this;
  }

  step(config) {
    this.workflow.steps.push(config);
    return this;
  }

  parallel(agents, options = {}) {
    return this.step({
      name: `parallel-${this.workflow.steps.length}`,
      agent: agents,
      parallel: true,
      mode: options.mode || 'all',
      ...options
    });
  }

  sequential(agent, role, options = {}) {
    return this.step({
      name: `step-${this.workflow.steps.length}`,
      agent,
      role,
      ...options
    });
  }

  build() {
    return this.workflow;
  }
}

// Usage example
const customWorkflow = new WorkflowBuilder()
  .name('my-custom-workflow')
  .sequential('claude', 'plan')
  .parallel(['claude', 'gemini'], { role: 'execute', mode: 'race' })
  .sequential('claude', 'review')
  .build();
```

### 5. Workflow Selection Logic

```javascript
class WorkflowSelector {
  constructor(workflows, rules) {
    this.workflows = workflows;
    this.rules = rules;
  }

  selectWorkflow(input, userPreference = null) {
    // User preference takes priority
    if (userPreference && this.workflows.has(userPreference)) {
      return userPreference;
    }

    // Apply auto-selection rules
    for (const rule of this.rules) {
      if (this.matchesRule(input, rule)) {
        return rule.workflow;
      }
    }

    // Default workflow
    return 'direct';
  }

  matchesRule(input, rule) {
    // Pattern matching
    if (rule.pattern && rule.pattern.test(input)) {
      return true;
    }

    // Length-based rules
    if (rule.length) {
      if (rule.length.min && input.length < rule.length.min) return false;
      if (rule.length.max && input.length > rule.length.max) return false;
      return true;
    }

    // Complexity detection
    if (rule.complexity) {
      const complexity = this.detectComplexity(input);
      return complexity === rule.complexity;
    }

    return false;
  }

  detectComplexity(input) {
    // Simple heuristics
    const lines = input.split('\n').length;
    const words = input.split(/\s+/).length;

    if (lines > 50 || words > 500) return 'high';
    if (lines > 10 || words > 100) return 'medium';
    return 'low';
  }
}
```

## Benefits

1. **User Control** - Define custom workflows
2. **Flexibility** - Conditional steps and branching
3. **Reusability** - Save and share workflows
4. **Optimization** - Choose best workflow for task
5. **Experimentation** - Test different approaches

## Testing Strategy

1. **Unit tests** for each workflow component
2. **Integration tests** for complete workflows
3. **Performance tests** for complex workflows
4. **Validation tests** for schema compliance
5. **User workflow tests** for custom definitions