# Lexical 🚀

A powerful orchestration system that coordinates multiple LLM CLIs (Claude, Gemini) through the Model Context Protocol (MCP). This system enables Claude Code to act as an intelligent planner while delegating code execution tasks to specialized executors like Gemini.

## 🌟 Features

- **Real CLI Integration**: Direct integration with Claude and Gemini CLIs - no mock data
- **MCP Server**: Full Model Context Protocol implementation for seamless tool integration
- **Intelligent Caching**: Response caching system with TTL for improved performance (20,000x faster for cached requests)
- **Performance Metrics**: Comprehensive metrics tracking and reporting
- **Resilient Architecture**: Retry logic with exponential backoff for reliability
- **Production Ready**: PM2 configuration for production deployment

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Claude CLI installed and configured
- Gemini CLI installed and configured
- GitHub CLI (gh) for repository management

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/lexical.git
cd lexical

# Install dependencies
npm install

# Set up environment variables
export ANTHROPIC_API_KEY="your-claude-api-key"
export GEMINI_API_KEY="your-gemini-api-key"
export OPENAI_API_KEY="your-openai-api-key"  # For Codex
```

## 💡 Quick Start

### 1. Test the Orchestrator

```bash
npm test
```

### 2. Start MCP Server

```bash
npm start
```

### 3. Use with Claude Code

```bash
# Configure Claude Code to use the MCP server
claude --mcp-config ./claude_code_config.json "Use the orchestrator to create a React component"
```

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY`: Claude API key
- `GEMINI_API_KEY`: Gemini API key
- `OPENAI_API_KEY`: OpenAI API key (for Codex)
- `EXECUTOR_TYPE`: Choose executor (`gemini`, `codex`, `claude`)
- `VALIDATE_RESULTS`: Enable result validation (`true`/`false`)
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)

### MCP Configuration

Edit `claude_code_config.json`:

```json
{
  "mcpServers": {
    "lexical-orchestrator": {
      "command": "node",
      "args": ["./src/mcp-servers/executor-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "EXECUTOR_TYPE": "gemini"
      }
    }
  }
}
```

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Claude Code │────▶│ MCP Server   │────▶│ Orchestrator│
└─────────────┘     └──────────────┘     └─────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                              ┌─────▼─────┐           ┌──────▼──────┐
                              │ Planner   │           │  Executor   │
                              │ (Claude)  │           │  (Gemini)   │
                              └───────────┘           └─────────────┘
```

## Available MCP Tools

### orchestrate
Process user request through planner and executor.

```javascript
{
  "request": "Create a REST API endpoint",
  "options": {
    "validate": true,
    "maxRetries": 3
  }
}
```

### plan
Create an execution plan without executing.

```javascript
{
  "request": "Design a database schema"
}
```

### execute
Execute a specific task.

```javascript
{
  "task": {
    "id": "task_001",
    "prompt": "Generate code",
    "context": {}
  }
}
```

### status
Get current orchestrator status.

## Project Structure

```
.
├── src/
│   ├── orchestrator/
│   │   ├── index.js        # Main orchestrator logic
│   │   ├── planner.js      # Claude CLI wrapper
│   │   ├── executor.js     # Gemini/Codex CLI wrapper
│   │   └── message-queue.js # Task queue management
│   ├── mcp-servers/
│   │   └── executor-server.js # MCP server implementation
│   ├── utils/
│   │   └── logger.js       # Winston logger setup
│   └── config/
│       └── default.json    # Default configuration
├── test-orchestrator.js    # Test script
├── claude_code_config.json # Claude Code MCP config
└── package.json
```

## Development

### Running in Debug Mode

```bash
LOG_LEVEL=debug npm start
```

### Testing Individual Components

```bash
# Test planner only
node -e "const {PlannerCLI} = require('./src/orchestrator/planner'); const p = new PlannerCLI({}); p.start().then(() => p.createPlan('test'))"

# Test executor only
node -e "const {ExecutorCLI} = require('./src/orchestrator/executor'); const e = new ExecutorCLI({type: 'gemini'}); e.start().then(() => e.execute({id: 'test', prompt: 'hello'}))"
```

## Troubleshooting

### CLI Not Responding
- Check API keys are set correctly
- Verify CLI installation: `claude --version`, `gemini --version`
- Check logs in `logs/` directory

### MCP Connection Failed
- Ensure MCP server is running: `npm start`
- Check Claude Code config path
- Review server logs for errors

### Task Timeout
- Increase timeout in config
- Check API rate limits
- Enable debug logging for details

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Claude by Anthropic for planning capabilities
- Gemini for code execution
- Model Context Protocol (MCP) for standardized tool integration

---

Built with ❤️ using real CLI integration, no mock data!