#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { MultiAgentOrchestrator } = require('../orchestrator/multi-agent-orchestrator.js');
const { WorkflowEngine } = require('../workflow/workflow-engine.js');
const { logger } = require('../utils/logger.js');
const SessionManager = require('../utils/session-manager.js');

class UniversalMCPServer {
  constructor() {
    this.orchestrator = new MultiAgentOrchestrator();
    this.workflowEngine = new WorkflowEngine();
    this.sessionManager = new SessionManager();
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
  }

  getAvailableTools() {
    return [
      {
        name: 'orchestrate',
        description: 'Process request with intelligent agent and workflow selection',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The task or request to process' },
            preferences: { type: 'object' }
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
        name: 'execute_code',
        description: 'Execute code generation task (legacy)',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The prompt for code generation' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'execute_task',
        description: 'Execute any task (legacy)',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                prompt: { type: 'string' }
              },
              required: ['prompt']
            }
          },
          required: ['task']
        }
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
          case 'execute_code':
            result = await this.handleLegacyExecuteCode(args);
            break;
          case 'execute_task':
            result = await this.handleLegacyExecuteTask(args);
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

  async handleOrchestrate(params) {
    console.log('handleOrchestrate called with:', params);
    // Proper implementation will call this.orchestrator
    return {
      success: true,
      result: 'Orchestration complete',
    };
  }

  async handleListWorkflows(params) {
    console.log('handleListWorkflows called with:', params);
    // Proper implementation will call this.workflowEngine
    return {
      workflows: [
        { name: 'plan-execute', description: 'Plan with one agent, execute with another.' },
        { name: 'direct', description: 'Direct execution of a task.' },
      ],
    };
  }

  async handleListAgents(params) {
    console.log('handleListAgents called with:', params);
    // Proper implementation will call this.orchestrator
    return {
      agents: [
        { name: 'claude', capabilities: ['plan', 'execute', 'review'] },
        { name: 'gemini', capabilities: ['execute'] },
      ],
    };
  }

  async handleLegacyExecuteCode(params) {
    console.log('handleLegacyExecuteCode called with:', params);
    return this.handleOrchestrate({
      prompt: params.prompt,
      preferences: {
        agent: 'gemini',
        role: 'execute',
        workflow: 'direct',
      },
    });
  }

  async handleLegacyExecuteTask(params) {
    console.log('handleLegacyExecuteTask called with:', params);
    return this.handleOrchestrate({
      prompt: params.task.prompt,
      preferences: {
        workflow: 'plan-execute',
      },
      context: { taskId: params.task.id },
    });
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('Universal MCP Server started successfully');
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