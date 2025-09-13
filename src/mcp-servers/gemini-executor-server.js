#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { Orchestrator } = require('../orchestrator/orchestrator.js');
const { logger } = require('../utils/logger.js');

const server = new Server(
  {
    name: 'gemini-executor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Create orchestrator instance
const orchestrator = new Orchestrator({
  executor: {
    type: 'gemini'
  }
});

// Tool definitions - ONLY executor tools, no planner needed!
const AVAILABLE_TOOLS = [
  {
    name: 'execute_code',
    description: 'Execute code generation task with Gemini',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt for code generation'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'execute_task',
    description: 'Execute any task with Gemini',
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

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('Listing executor tools');
  return {
    tools: AVAILABLE_TOOLS
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`Executing tool: ${name}`, args);

  try {
    let result;

    switch (name) {
      case 'execute_code':
        // Direct Gemini execution
        result = await orchestrator.executeWithGemini(args.prompt);
        break;

      case 'execute_task':
        // Execute with task structure
        result = await orchestrator.execute(args.task);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
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

// Start server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Gemini Executor MCP Server started');
    console.error('Gemini Executor MCP Server v1.0.0');
    console.error('Ready to execute tasks with Gemini');
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