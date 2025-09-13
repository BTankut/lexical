const { v4: generateId } = require('uuid');
const builtInWorkflows = require('../../config/workflows/built-in.js');

class WorkflowEngine {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.workflows = new Map();
    this.loadBuiltinWorkflows();
  }

  loadBuiltinWorkflows() {
    for (const [name, workflow] of Object.entries(builtInWorkflows)) {
      this.workflows.set(name, workflow);
    }
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

        if (step.loop_to && stepResult.status !== 'failed') {
          const loopToIndex = this.findStepIndex(workflow, step.loop_to);
          const loopCount = execution.steps.filter(s => s.name === step.name).length;
          if (!workflow.settings?.maxIterations || loopCount < workflow.settings.maxIterations) {
            i = loopToIndex - 1; // loop back
            continue;
          }
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

      execution.status = execution.status === 'running' ? 'completed' : execution.status;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      return execution;

    } catch (error) {
      execution.status = 'error';
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
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
      const delayMs = (retryConfig.delay || 1000) * Math.pow(retryConfig.backoffFactor || 2, attempt - 1);
      await this.delay(delayMs);

      try {
        // We need to create a new step object without the retry configuration
        // to prevent an infinite loop of retries.
        const stepWithoutRetry = { ...step };
        delete stepWithoutRetry.retry;
        
        return await this.executeStep(
          stepWithoutRetry,
          input,
          execution
        );
      } catch (error) {
        lastAttemptError = error;
      }
    }

    return {
        name: step.name,
        status: 'failed',
        error: `Step failed after ${retryConfig.attempts} retries: ${lastAttemptError.message}`,
        duration: 0 // This will be recalculated in the calling function
    };
  }

  findStepIndex(workflow, stepName) {
    const index = workflow.steps.findIndex(step => step.name === stepName);
    if (index === -1) {
      throw new Error(`Step ${stepName} not found in workflow`);
    }
    return index;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WorkflowEngine;
