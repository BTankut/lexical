#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { Orchestrator } = require('../orchestrator/index.js');
const { logger } = require('../utils/logger.js');

const server = new Server(
  {
    name: 'lexical-orchestrator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

let orchestrator = null;

// Tool definitions
const AVAILABLE_TOOLS = [
  {
    name: 'orchestrate',
    description: 'Process user request through planner and executor',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'The user request to process'
        }
      },
      required: ['request']
    }
  },
  {
    name: 'plan',
    description: 'Create an execution plan without executing',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: 'The user request to plan'
        }
      },
      required: ['request']
    }
  },
  {
    name: 'execute',
    description: 'Execute a specific task',
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
  },
  {
    name: 'status',
    description: 'Get current orchestrator status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('Listing available tools');
  return {
    tools: AVAILABLE_TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`Executing tool: ${name}`, args);

  try {
    // Initialize orchestrator if needed
    if (!orchestrator) {
      orchestrator = new Orchestrator({
        planner: {
          apiKey: process.env.ANTHROPIC_API_KEY,
        },
        executor: {
          type: process.env.EXECUTOR_TYPE || 'gemini',
          apiKey: process.env.EXECUTOR_TYPE === 'gemini'
            ? process.env.GEMINI_API_KEY
            : process.env.ANTHROPIC_API_KEY,
        },
        validateResults: process.env.VALIDATE_RESULTS === 'true'
      });
      await orchestrator.initialize();
    }

    let result;
    switch (name) {
      case 'orchestrate':
        result = await orchestrator.processUserRequest(args.request);
        break;

      case 'plan':
        result = await orchestrator.planner.createPlan(args.request);
        break;

      case 'execute':
        result = await orchestrator.executor.execute(args.task);
        break;

      case 'status':
        result = {
          state: orchestrator.state,
          planner: { active: !!orchestrator.planner.process },
          executor: {
            type: orchestrator.executor.type,
            active: !!orchestrator.executor.process
          }
        };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    logger.error(`Tool ${name} failed:`, error);
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

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  if (orchestrator) {
    await orchestrator.shutdown();
  }
  process.exit(0);
});

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP Server started successfully');
    console.error('Lexical Orchestrator MCP Server v1.0.0');
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  console.error('Fatal error:', error);
  process.exit(1);
});