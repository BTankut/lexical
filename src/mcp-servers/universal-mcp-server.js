#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { MultiAgentOrchestrator } = require('../orchestrator/multi-agent-orchestrator.js');
const WorkflowEngine = require('../workflow/workflow-engine.js');
const { logger } = require('../utils/logger.js');
const SessionManager = require('../utils/session-manager.js');
const { GeminiChatManager } = require('../utils/gemini-chat-manager.js');
const ExecutorManager = require('../executor/executor-manager.js');
const { processMonitor } = require('../utils/process-monitor.js');

class UniversalMCPServer {
  constructor() {
    this.orchestrator = new MultiAgentOrchestrator({ executor: { type: 'gemini' } });
    this.workflowEngine = new WorkflowEngine(this.orchestrator);
    this.sessionManager = new SessionManager('lexical-mcp-main');

    // Use ExecutorManager instead of direct GeminiChatManager
    this.executorManager = new ExecutorManager();

    // Keep geminiChatManager for backward compatibility (will remove in Phase 2)
    this.geminiChatManager = new GeminiChatManager(this.sessionManager);

    this.server = new Server(
      {
        name: 'lexical-universal',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.registerTools();

    // Start process monitoring for safety
    processMonitor.startMonitoring();
    logger.info('Process monitoring enabled for CPU safety');
  }

  getAvailableTools() {
    return [
      {
        name: 'orchestrate',
        description: 'Process request with configured executor and intelligent workflow selection.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The task or request to process' },
            preferences: {
              type: 'object',
              properties: {
                workflow: {
                  type: 'string',
                  enum: ['auto', 'direct', 'plan-execute'],
                  description: 'Workflow type (auto for automatic selection)'
                }
              }
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'list_workflows',
        description: 'List all available workflows',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'list_agents',
        description: 'List all available agents',
        inputSchema: { type: 'object', properties: {} }
},
      {
        name: 'save_chat_session',
        description: 'Saves the current chat session',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'resume_chat_session',
        description: 'Resumes the last chat session',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'orchestrate_workflow',
        description: 'Execute a specific workflow with full control',
        inputSchema: {
          type: 'object',
          properties: {
            workflow: { type: 'string', description: 'Workflow name or inline workflow definition' },
            input: { type: 'string', description: 'Input for the workflow' },
            context: { type: 'object', description: 'Initial context for workflow execution' },
            overrides: { type: 'object', description: 'Override agent/timeout settings' }
          },
          required: ['workflow', 'input']
        }
      },
      {
        name: 'orchestrate_parallel',
        description: 'Execute task with multiple agents in parallel',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Task to execute' },
            agents: { type: 'array', items: { type: 'string' }, description: 'Agents to use' },
            mode: { type: 'string', enum: ['race', 'all', 'vote'], description: 'How to handle parallel results' },
            role: { type: 'string', description: 'Role for all agents' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'get_capabilities',
        description: 'Get detailed capabilities for task matching',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task description for capability matching' },
            requirements: { type: 'object', description: 'Requirements for agent selection' }
          }
        }
      },
      {
        name: 'get_process_stats',
        description: 'Get system process monitoring statistics',
        inputSchema: { type: 'object', properties: {} }
      }
    ];
  }

  registerTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Listing available tools');
      return {
        tools: this.getAvailableTools()
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info(`[Session: ${this.sessionManager.sessionId}] Executing tool: ${name}`, args);

      this.sessionManager.addOperation({
        type: 'tool_call',
        toolName: name,
        arguments: args,
      });

      try {
        let result;
        switch (name) {
          case 'orchestrate':
            result = await this.handleOrchestrate(args);
            break;
          case 'list_workflows':
            result = await this.handleListWorkflows(args);
            break;
          case 'list_agents':
            result = await this.handleListAgents(args);
            break;
          case 'save_chat_session':
            result = await this.handleSaveChatSession(args);
            break;
          case 'resume_chat_session':
            result = await this.handleResumeChatSession(args);
            break;
          case 'orchestrate_workflow':
            result = await this.handleOrchestrateWorkflow(args);
            break;
          case 'orchestrate_parallel':
            result = await this.handleOrchestrateParallel(args);
            break;
          case 'get_capabilities':
            result = await this.handleGetCapabilities(args);
            break;
          case 'get_process_stats':
            result = await this.handleGetProcessStats(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        this.sessionManager.addOperation({
          type: 'tool_result',
          toolName: name,
          result,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error(`[Session: ${this.sessionManager.sessionId}] Tool ${name} failed:`, error);
        this.sessionManager.addOperation({
          type: 'tool_error',
          toolName: name,
          error: error.message,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async handleSaveChatSession(params) {
    // console.log removed to avoid breaking MCP protocol
    return await this.geminiChatManager.saveSession();
  }

  async handleResumeChatSession(params) {
    // console.log removed to avoid breaking MCP protocol
    return await this.geminiChatManager.resumeSession();
  }

  async handleOrchestrate(params) {
    // Enhanced orchestrate with workflow and agent selection
    const { prompt, preferences = {} } = params;

    try {
      // Handle special list requests
      if (prompt.match(/list.*workflows?/i)) {
        const workflowList = await this.handleListWorkflows({});
        return {
          success: true,
          result: JSON.stringify(workflowList, null, 2),
          agent: 'system',
          workflow: 'info'
        };
      }
      if (prompt.match(/list.*agents?/i)) {
        const agentList = await this.handleListAgents({});
        return {
          success: true,
          result: JSON.stringify(agentList, null, 2),
          agent: 'system',
          workflow: 'info'
        };
      }

      const { workflow = 'auto' } = preferences;

      // Auto-select workflow if needed (REAL logic, not fake)
      let selectedWorkflow = workflow;
      if (workflow === 'auto') {
        // Detect workflow based on prompt
        if (prompt.match(/plan|design|architect/i)) {
          selectedWorkflow = 'plan-execute';
        } else {
          selectedWorkflow = 'direct';
        }
      }

      // Execute with REAL executor (no fake agent selection)
      let result;
      if (selectedWorkflow === 'plan-execute' && this.workflowEngine) {
        // Use workflow engine for complex workflows
        const workflowResult = await this.workflowEngine.execute(selectedWorkflow, prompt, {});
        result = workflowResult.steps.map(s => s.output).join('\n');
      } else {
        // Use ExecutorManager with configured executor
        result = await this.executorManager.execute(prompt);
      }

      return {
        success: true,
        result: result,
        executor: this.executorManager.executorType, // REAL executor being used
        workflow: selectedWorkflow
      };
    } catch (error) {
      logger.error('Orchestration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleListWorkflows(params) {
    // Return actual workflows from the workflow engine
    const workflows = [];

    // Get built-in workflows
    if (this.workflowEngine && this.workflowEngine.workflows) {
      for (const [name, workflow] of this.workflowEngine.workflows.entries()) {
        workflows.push({
          name: name,
          description: workflow.description || `${name} workflow`,
          steps: workflow.steps ? workflow.steps.length : 0
        });
      }
    }

    // Add default workflows if none found
    if (workflows.length === 0) {
      workflows.push(
        { name: 'direct', description: 'Direct execution of a task', steps: 1 },
        { name: 'plan-execute', description: 'Plan with one agent, execute with another', steps: 2 }
      );
    }

    return { workflows };
  }

  async handleListAgents(params) {
    // Return actual agents from the orchestrator
    const agents = [];

    // Get agents from registry if available
    if (this.orchestrator && this.orchestrator.agentRegistry) {
      const registry = this.orchestrator.agentRegistry;
      for (const [name, agent] of registry.agents.entries()) {
        const capabilities = registry.capabilities.get(name) || {};
        agents.push({
          name: name,
          capabilities: Object.keys(capabilities).filter(k => capabilities[k] > 0.5),
          status: 'available',
          contextWindow: capabilities.contextWindow || 0
        });
      }
    }

    // Add default agents if none found
    if (agents.length === 0) {
      agents.push(
        { name: 'claude', capabilities: ['plan', 'execute', 'review'], status: 'available' },
        { name: 'gemini', capabilities: ['execute'], status: 'available' }
      );
    }

    return { agents };
  }


  async handleOrchestrateWorkflow(params) {
    // console.log removed to avoid breaking MCP protocol
    const { workflow, input, context = {}, overrides = {} } = params;

    try {
      const result = await this.workflowEngine.execute(workflow, input, context);
      return {
        success: true,
        workflow: workflow,
        result: result,
        duration: result.duration
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        workflow: workflow
      };
    }
  }

  async handleOrchestrateParallel(params) {
    // console.log removed to avoid breaking MCP protocol
    const { prompt, agents = ['claude', 'gemini'], mode = 'all', role = 'execute' } = params;

    try {
      const results = await this.orchestrator.executeParallel(prompt, agents, { role, mode });

      let finalResult;
      if (mode === 'race') {
        // Return first successful result
        finalResult = results.find(r => !r.error) || results[0];
      } else if (mode === 'vote') {
        // Simple voting - return most common result (placeholder)
        finalResult = results[0];
      } else {
        // Return all results
        finalResult = results;
      }

      return {
        success: true,
        mode: mode,
        agents: agents,
        results: finalResult,
        totalResults: results.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        agents: agents
      };
    }
  }

  async handleGetCapabilities(params) {
    // console.log removed to avoid breaking MCP protocol
    const { task = '', requirements = {} } = params;

    // Get all agents and their capabilities
    const agents = [
      {
        name: 'claude',
        capabilities: {
          planning: 0.95,
          execution: 0.85,
          review: 0.90,
          contextWindow: 200000,
          languages: ['python', 'javascript', 'go']
        }
      },
      {
        name: 'gemini',
        capabilities: {
          planning: 0.85,
          execution: 0.95,
          review: 0.80,
          contextWindow: 1000000,
          languages: ['python', 'javascript', 'java']
        }
      }
    ];

    // Score agents based on requirements
    const recommendations = agents.map(agent => {
      let score = 0;
      const reasons = [];
      const warnings = [];

      // Role capability scoring
      if (requirements.role && agent.capabilities[requirements.role]) {
        score += agent.capabilities[requirements.role] * 10;
        reasons.push(`${requirements.role} capability: ${agent.capabilities[requirements.role]}`);
      }

      // Language preference
      if (requirements.language && agent.capabilities.languages?.includes(requirements.language)) {
        score += 5;
        reasons.push(`Supports ${requirements.language}`);
      }

      // Context window requirement
      if (requirements.contextSize) {
        if (agent.capabilities.contextWindow >= requirements.contextSize) {
          score += 3;
          reasons.push(`Context window sufficient: ${agent.capabilities.contextWindow}`);
        } else {
          warnings.push(`Context window may be insufficient: ${agent.capabilities.contextWindow} < ${requirements.contextSize}`);
        }
      }

      return {
        agent: agent.name,
        score: score,
        reasons,
        warnings,
        capabilities: agent.capabilities
      };
    }).sort((a, b) => b.score - a.score);

    return {
      task: task,
      requirements: requirements,
      recommendations: recommendations
    };
  }

  async handleGetProcessStats(params) {
    console.log('handleGetProcessStats called with:', params);

    const stats = processMonitor.getStats();
    return {
      monitoring: {
        active: stats.monitoringActive,
        checkInterval: '10 seconds',
        maxCpuThreshold: '50%',
        maxProcessAge: '5 minutes'
      },
      processes: stats.processes,
      summary: {
        totalActiveProcesses: stats.activeProcesses,
        systemHealth: stats.activeProcesses < 5 ? 'good' : 'warning',
        lastCheck: new Date().toISOString()
      }
    };
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('MCP Server started successfully');
      console.error('Lexical Universal MCP Server v2.0.0');
    } catch (error) {
      logger.error('Failed to start MCP server:', error);
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const universalServer = new UniversalMCPServer();
  universalServer.start().catch((error) => {
    logger.error('Fatal error:', error);
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { UniversalMCPServer };