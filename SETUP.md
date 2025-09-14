# 🚀 Lexical Setup Guide

This guide will help you set up the Lexical Universal MCP Server on a new machine.

## 📋 Prerequisites

### 1. Node.js (v18+)
```bash
# Check if installed
node --version

# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Or via Homebrew (macOS)
brew install node
```

### 2. Claude CLI
```bash
# Install Claude CLI (requires API key)
npm install -g @anthropic-ai/claude-cli

# Configure with your API key
claude auth login
```

### 3. Gemini CLI
```bash
# Install Gemini CLI
npm install -g @google/generative-ai-cli

# Configure with your API key
gemini auth login
```

### 4. GitHub CLI (optional, for PR operations)
```bash
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

## 🔧 Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/BTankut/lexical.git
cd lexical
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure MCP Server

#### Option A: Manual Configuration

1. Copy the template configuration:
```bash
cp claude_code_config.template.json claude_code_config.json
```

2. Edit `claude_code_config.json` and replace placeholders:
```json
{
  "mcpServers": {
    "lexical-universal": {
      "command": "{{NODE_PATH}}",  // Replace with: which node
      "args": ["{{PROJECT_PATH}}/src/mcp-servers/universal-mcp-server.js"],
      "cwd": "{{PROJECT_PATH}}",   // Replace with: pwd
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "EXECUTOR_TYPE": "gemini",
        "LOG_LEVEL": "info",
        "PATH": "{{NODE_BIN_DIR}}:${PATH}"  // Parent dir of node
      }
    }
  }
}
```

3. Find your paths:
```bash
# Get node path
which node
# Example output: /opt/homebrew/bin/node

# Get project path
pwd
# Example output: /Users/username/Projects/lexical

# Get node bin directory
dirname $(which node)
# Example output: /opt/homebrew/bin
```

#### Option B: Automated Setup (Unix/macOS)
```bash
# Run the setup script
./setup.sh
```

### 4. Register MCP Server with Claude

```bash
# Add the MCP server to Claude Code
claude mcp add $(pwd)

# Or manually specify the config
claude mcp add $(pwd)/claude_code_config.json
```

### 5. Create Required Directories
```bash
# Create sessions directory for context persistence
mkdir -p sessions

# Create logs directory (optional)
mkdir -p logs
```

## ✅ Verification

### 1. Test MCP Server Directly
```bash
# Start the server manually
node src/mcp-servers/universal-mcp-server.js

# Should see: "MCP server started on stdio"
```

### 2. Test with PM2 (Production)
```bash
# Install PM2 globally if not installed
npm install -g pm2

# Start with PM2
npm start

# Check status
pm2 status

# View logs
pm2 logs lexical-universal
```

### 3. Test in Claude Code
```bash
# Open Claude Code and test a command
claude "list available MCP tools"

# Should see the orchestrate tool and others
```

## 🔍 Troubleshooting

### Common Issues

#### 1. "command not found: node"
- Install Node.js (see Prerequisites)
- Make sure node is in your PATH

#### 2. "ENOENT: no such file or directory"
- Check that all paths in claude_code_config.json are absolute paths
- Verify the project was cloned correctly

#### 3. "MCP server connection failed"
- Check Claude Code logs: `~/.claude/logs/`
- Verify the config file syntax is correct
- Ensure all required environment variables are set

#### 4. "Gemini command failed"
- Verify Gemini CLI is installed and authenticated
- Check that GEMINI_API_KEY is available in environment

#### 5. Port already in use (PM2)
- Stop any existing PM2 processes: `pm2 stop all`
- Or kill specific process: `pm2 delete lexical-universal`

### Debug Commands
```bash
# Check Node installation
node --version
npm --version

# Check CLI installations
claude --version
gemini --version

# Verify paths
echo $PATH
which node
which claude
which gemini

# Test environment variables
echo $GEMINI_API_KEY
echo $ANTHROPIC_API_KEY

# Check MCP registration
claude mcp list

# View Claude Code config
cat ~/.claude/claude_code_config.json
```

## 📁 Project Structure

```
lexical/
├── src/
│   ├── mcp-servers/
│   │   └── universal-mcp-server.js    # Main MCP server
│   ├── orchestrator/                   # Orchestration logic
│   ├── agents/                         # Agent implementations
│   ├── cli/                           # CLI wrappers
│   └── utils/                         # Utilities
├── sessions/                          # Context persistence (git-ignored)
├── logs/                              # Application logs (git-ignored)
├── claude_code_config.json            # Your config (git-ignored)
├── claude_code_config.template.json   # Config template
├── package.json                       # Dependencies
├── pm2.config.js                      # PM2 configuration
├── setup.sh                           # Setup script
└── SETUP.md                           # This file
```

## 🔐 Security Notes

1. **Never commit API keys** - Use environment variables
2. **Keep claude_code_config.json private** - It's in .gitignore
3. **Session files are personal** - sessions/ folder is git-ignored
4. **Use different API keys for dev/prod** if possible

## 📚 Next Steps

After successful setup:

1. Read [README.md](README.md) for usage instructions
2. Check [MCP_TOOLS_GUIDE.md](MCP_TOOLS_GUIDE.md) for available tools
3. Review [GEMINI_MCP_GUIDE.md](GEMINI_MCP_GUIDE.md) for Gemini integration details

## 🆘 Support

If you encounter issues not covered here:

1. Check existing issues: https://github.com/BTankut/lexical/issues
2. Review implementation details: [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md)
3. Create a new issue with:
   - Your OS and Node version
   - Error messages
   - Steps to reproduce

---

Happy orchestrating! 🎭