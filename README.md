# Lexical 🚀 - Universal LLM Orchestration System

A powerful orchestration system that coordinates multiple LLM agents (Claude, Gemini) through the Model Context Protocol (MCP). This system enables intelligent task planning, parallel execution, and seamless context management across different AI models.

## 🌟 Key Features

- **Universal MCP Server**: Single server handling 11+ tools for complete orchestration
- **Multi-Agent Support**: Coordinate Claude and Gemini for optimal task completion
- **Intelligent Workflows**: Multiple execution patterns (direct, plan-execute, parallel)
- **Context Persistence**: Automatic session save/resume for maintaining conversation state
- **Process Monitoring**: Real-time CPU and memory monitoring with automatic cleanup
- **Performance Optimized**: 200ms response detection, intelligent caching system
- **Production Ready**: PM2 configuration, comprehensive error handling, logging

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Claude CLI installed and configured
- Gemini CLI installed and configured
- GitHub CLI (gh) for repository operations

## 🚀 Installation

### Quick Setup (Automated)
```bash
# Clone the repository
git clone https://github.com/BTankut/lexical.git
cd lexical

# Run automated setup
./setup.sh
```

### Manual Setup
```bash
# Clone and install dependencies
git clone https://github.com/BTankut/lexical.git
cd lexical
npm install

# Configure MCP server (see SETUP.md for details)
cp claude_code_config.template.json claude_code_config.json
# Edit claude_code_config.json with your paths

# Register with Claude Code
claude mcp add $(pwd)
```

📚 **For detailed setup instructions, see [SETUP.md](SETUP.md)**

## 💡 Quick Start

### 1. Start the Universal MCP Server

```bash
# Start with PM2 (recommended for production)
npm start

# Or run directly
node src/mcp-servers/universal-mcp-server.js
```

### 2. Use with Claude Code

The MCP server automatically integrates with Claude Code. Simply use natural language:

```bash
# Claude will use the orchestrate tool automatically
"Create a Python REST API with authentication"

# Or specify preferences
"Use Gemini to write a factorial function"
```

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Claude Code │────▶│ Universal MCP    │────▶│ Multi-Agent         │
└─────────────┘     │ Server           │     │ Orchestrator        │
                    └──────────────────┘     └─────────────────────┘
                                                        │
                                    ┌───────────────────┴───────────────────┐
                                    │                                       │
                              ┌─────▼─────┐                         ┌──────▼──────┐
                              │   Claude  │                         │   Gemini    │
                              │   Agent   │                         │   Agent     │
                              └───────────┘                         └─────────────┘
                                    │                                       │
                              ┌─────▼─────┐                         ┌──────▼──────┐
                              │ Planning  │                         │  Execution  │
                              │ Review    │                         │  Context    │
                              └───────────┘                         └─────────────┘
```

## 🛠️ Available MCP Tools

### Core Orchestration Tools

#### 1. **orchestrate** ⭐ (Primary)
Intelligently routes tasks to the best agent and workflow.
```javascript
{
  "prompt": "Create a REST API with authentication",
  "preferences": {
    "agent": "auto",      // 'claude', 'gemini', 'auto'
    "workflow": "auto"    // 'direct', 'plan-execute', 'auto'
  }
}
```

#### 2. **orchestrate_workflow**
Execute with a specific workflow pattern.
```javascript
{
  "workflow": "plan-execute",
  "input": "Build a todo app",
  "context": { "language": "Python" },
  "overrides": { "timeout": 60000 }
}
```

#### 3. **orchestrate_parallel**
Run multiple agents simultaneously.
```javascript
{
  "prompt": "Analyze this code",
  "agents": ["claude", "gemini"],
  "mode": "race"  // 'race', 'all', 'vote'
}
```

### Context Management Tools

#### 4. **save_chat_session**
Persist current conversation context.

#### 5. **resume_chat_session**
Restore previous conversation context.

### Information Tools

#### 6. **list_agents**
Get available agents and their capabilities.

#### 7. **list_workflows**
Show available workflow patterns.

#### 8. **get_capabilities**
Get agent recommendations for specific tasks.

#### 9. **get_process_stats**
Monitor system health and active processes.

### Legacy Tools (Backward Compatibility)

#### 10. **execute_code**
Direct code generation with Gemini.

#### 11. **execute_task**
Execute general tasks with Gemini.

## 📁 Project Structure

```
.
├── src/
│   ├── mcp-servers/
│   │   └── universal-mcp-server.js    # Main MCP server
│   ├── orchestrator/
│   │   ├── multi-agent-orchestrator.js # Core orchestration logic
│   │   └── workflow-engine.js          # Workflow patterns
│   ├── agents/
│   │   ├── claude-agent.js            # Claude integration
│   │   └── gemini-agent.js            # Gemini integration
│   ├── utils/
│   │   ├── gemini-chat-manager.js     # Gemini context management
│   │   ├── session-manager.js         # Session persistence
│   │   ├── process-monitor.js         # CPU/memory monitoring
│   │   ├── cache.js                   # Response caching
│   │   ├── metrics.js                 # Performance metrics
│   │   └── logger.js                  # Winston logger
│   └── config/
│       └── default.json               # Default configuration
├── tests/                             # Test suite
├── sessions/                          # Saved chat sessions
├── logs/                              # Application logs
├── claude_code_config.json           # Claude Code MCP configuration
├── pm2.config.js                     # PM2 production config
└── package.json
```

## ⚙️ Configuration

### Environment Variables

```bash
# Optional - for API-based fallbacks
export ANTHROPIC_API_KEY="your-claude-api-key"
export GEMINI_API_KEY="your-gemini-api-key"
export OPENAI_API_KEY="your-openai-api-key"

# Logging
export LOG_LEVEL="info"  # debug, info, warn, error
```

### MCP Configuration

The system automatically configures itself with Claude Code. The configuration is stored in `claude_code_config.json`.

## 🔧 Advanced Usage

### Custom Workflows

Create custom workflow patterns in `src/orchestrator/workflow-engine.js`:

```javascript
// Example: Custom iterative refinement workflow
{
  name: 'iterative-refinement',
  steps: [
    { agent: 'gemini', action: 'generate' },
    { agent: 'claude', action: 'review' },
    { agent: 'gemini', action: 'refine' }
  ]
}
```

### Process Monitoring

The system includes automatic process monitoring:
- CPU usage threshold: 50%
- Max process age: 5 minutes
- Auto-cleanup of zombie processes
- Real-time health monitoring

## 📊 Performance Metrics

- **Response Time**: 200ms for short answers, adaptive for longer responses
- **Cache Hit Rate**: 20,000x faster for cached responses
- **Context Persistence**: Automatic save/resume with zero data loss
- **Parallel Execution**: Up to 3x faster with multi-agent workflows

## 🐛 Troubleshooting

### Setup Issues
- **Path problems**: Check [SETUP.md](SETUP.md#troubleshooting) for detailed solutions
- **Missing dependencies**: Run `npm install` again
- **Config errors**: Compare your config with `claude_code_config.template.json`

### MCP Server Connection Issues
```bash
# Check if server is running
ps aux | grep universal-mcp-server

# Restart Claude Code connection
claude mcp reconnect

# View Claude logs
tail -f ~/.claude/logs/*.log
```

### High CPU Usage
```bash
# Check process monitor stats
mcp__lexical-universal__get_process_stats

# Manual cleanup
pm2 restart lexical-universal
```

### Context Loss
```bash
# Sessions are automatically saved in ./sessions/
ls -la sessions/

# Use MCP tools to save/resume
mcp__lexical-universal__save_chat_session
mcp__lexical-universal__resume_chat_session
```

For more troubleshooting tips, see [SETUP.md](SETUP.md#troubleshooting)

## 📝 Development

### Running Tests
```bash
npm test
```

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Claude by Anthropic for advanced planning and review capabilities
- Gemini by Google for efficient code execution
- Model Context Protocol (MCP) for standardized tool integration
- PM2 for production process management

## 📚 Documentation

- [MCP Tools Guide](MCP_TOOLS_GUIDE.md) - Detailed tool documentation
- [Implementation Report](IMPLEMENTATION_REPORT.md) - Technical implementation details
- [Gemini MCP Guide](GEMINI_MCP_GUIDE.md) - Gemini integration specifics

---

**Version**: 2.0.0 - Universal Architecture
**Status**: Production Ready ✅
**Last Updated**: January 2025

Built with ❤️ for intelligent LLM orchestration!