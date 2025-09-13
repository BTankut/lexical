#!/bin/bash

echo "Testing MCP Server Integration"
echo "=============================="
echo ""

# Test 1: Check if server starts
echo "1. Testing server startup..."
timeout 10 npm run start:universal 2>&1 | grep "MCP Server started successfully" && echo "✓ Server starts correctly" || echo "✗ Server failed to start"

# Test 2: Check if Claude can see the MCP server
echo ""
echo "2. Testing Claude MCP detection..."
echo "Run: claude mcp"
echo "Expected: Should list 'lexical-orchestrator' server"

# Test 3: Interactive test suggestion
echo ""
echo "3. To test the tools, run Claude and try:"
echo "   claude"
echo "   Then use: /mcp orchestrate 'Create a hello world function'"
echo ""
echo "Available MCP tools:"
echo "  - orchestrate: Process request through planner and executor"
echo "  - plan: Create execution plan"
echo "  - execute: Execute specific task"
echo "  - status: Get orchestrator status"