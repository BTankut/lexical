# MCP Server Connection Fix Documentation

## Problem
Both MCP servers (gemini-executor and lexical-universal) were failing with connection errors after configuration changes.

## Root Cause
1. **Incorrect node path**: Config was using `node` instead of full path `/opt/homebrew/bin/node`
2. **Missing working directory**: Servers need `cwd` parameter to find relative modules
3. **Absolute vs relative paths**: Args should use absolute paths for reliability

## Solution Applied

### Updated Configuration (claude_code_config.json)
```json
{
  "mcpServers": {
    "gemini-executor": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/btankut/Projects/Lexical-TUI-Claude/src/mcp-servers/gemini-executor-server.js"],
      "cwd": "/Users/btankut/Projects/Lexical-TUI-Claude",
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "LOG_LEVEL": "info",
        "PATH": "/opt/homebrew/bin:${PATH}"
      }
    },
    "lexical-universal": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/Users/btankut/Projects/Lexical-TUI-Claude/src/mcp-servers/universal-mcp-server.js"],
      "cwd": "/Users/btankut/Projects/Lexical-TUI-Claude",
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "EXECUTOR_TYPE": "gemini",
        "LOG_LEVEL": "info",
        "PATH": "/opt/homebrew/bin:${PATH}"
      }
    }
  }
}
```

## Key Changes
1. **Full node path**: `/opt/homebrew/bin/node` instead of `node`
2. **Absolute script paths**: Full paths in args array
3. **Working directory**: Added `cwd` parameter
4. **PATH environment**: Ensures node modules are found

## Testing Commands
```bash
# Test MCP server list
claude mcp list

# Manual server test
/opt/homebrew/bin/node src/mcp-servers/gemini-executor-server.js

# Check node location
which node
```

## Status
- ✅ gemini-executor: Working (tested and responds)
- ✅ lexical-universal: Fixed configuration, starts successfully

## Notes
- Both servers are now configured in parallel
- gemini-executor: Legacy server that successfully completed all previous tasks
- lexical-universal: New universal architecture server with multi-agent support