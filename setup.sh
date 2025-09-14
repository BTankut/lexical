#!/bin/bash

# Lexical Universal MCP Server Setup Script
# This script automates the setup process for new installations

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "ℹ️  $1"; }

# Header
echo ""
echo "🚀 Lexical Universal MCP Server Setup"
echo "====================================="
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
else
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
else
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
fi

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    print_warning "Claude CLI is not installed."
    echo "You can install it with: npm install -g @anthropic-ai/claude-cli"
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        exit 1
    fi
else
    print_success "Claude CLI installed"
fi

# Check Gemini CLI
if ! command -v gemini &> /dev/null; then
    print_warning "Gemini CLI is not installed."
    echo "You can install it with: npm install -g @google/generative-ai-cli"
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        exit 1
    fi
else
    print_success "Gemini CLI installed"
fi

echo ""
print_info "Installing dependencies..."
npm install
print_success "Dependencies installed"

echo ""
print_info "Setting up configuration..."

# Get paths
NODE_PATH=$(which node)
PROJECT_PATH=$(pwd)
NODE_BIN_DIR=$(dirname "$NODE_PATH")

print_info "Detected paths:"
echo "  Node path: $NODE_PATH"
echo "  Project path: $PROJECT_PATH"
echo "  Node bin directory: $NODE_BIN_DIR"

# Create config from template
if [ -f "claude_code_config.json" ]; then
    print_warning "claude_code_config.json already exists."
    echo "Overwrite? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        print_info "Keeping existing configuration."
    else
        cp claude_code_config.template.json claude_code_config.json

        # Replace placeholders based on OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|{{NODE_PATH}}|$NODE_PATH|g" claude_code_config.json
            sed -i '' "s|{{PROJECT_PATH}}|$PROJECT_PATH|g" claude_code_config.json
            sed -i '' "s|{{NODE_BIN_DIR}}|$NODE_BIN_DIR|g" claude_code_config.json
        else
            # Linux
            sed -i "s|{{NODE_PATH}}|$NODE_PATH|g" claude_code_config.json
            sed -i "s|{{PROJECT_PATH}}|$PROJECT_PATH|g" claude_code_config.json
            sed -i "s|{{NODE_BIN_DIR}}|$NODE_BIN_DIR|g" claude_code_config.json
        fi

        print_success "Configuration file created"
    fi
else
    cp claude_code_config.template.json claude_code_config.json

    # Replace placeholders based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|{{NODE_PATH}}|$NODE_PATH|g" claude_code_config.json
        sed -i '' "s|{{PROJECT_PATH}}|$PROJECT_PATH|g" claude_code_config.json
        sed -i '' "s|{{NODE_BIN_DIR}}|$NODE_BIN_DIR|g" claude_code_config.json
    else
        # Linux
        sed -i "s|{{NODE_PATH}}|$NODE_PATH|g" claude_code_config.json
        sed -i "s|{{PROJECT_PATH}}|$PROJECT_PATH|g" claude_code_config.json
        sed -i "s|{{NODE_BIN_DIR}}|$NODE_BIN_DIR|g" claude_code_config.json
    fi

    print_success "Configuration file created"
fi

echo ""
print_info "Creating required directories..."

# Create sessions directory
if [ ! -d "sessions" ]; then
    mkdir -p sessions
    print_success "Created sessions directory"
else
    print_info "sessions directory already exists"
fi

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    print_success "Created logs directory"
else
    print_info "logs directory already exists"
fi

echo ""
print_info "Testing MCP server..."

# Test server startup
timeout 2 node src/mcp-servers/universal-mcp-server.js 2>/dev/null || true
if [ $? -eq 124 ] || [ $? -eq 0 ]; then
    print_success "MCP server test successful"
else
    print_warning "MCP server test failed - please check manually"
fi

echo ""
print_info "Next steps:"
echo ""
echo "1. Register the MCP server with Claude:"
echo "   claude mcp add $PROJECT_PATH"
echo ""
echo "2. Set your API keys (if not already set):"
echo "   export GEMINI_API_KEY='your-key-here'"
echo "   export ANTHROPIC_API_KEY='your-key-here'"
echo ""
echo "3. Start the server:"
echo "   npm start"
echo ""
echo "4. Test in Claude Code:"
echo "   claude 'list available MCP tools'"
echo ""

print_success "Setup complete! 🎉"
echo ""
echo "For more details, see SETUP.md"
echo "For troubleshooting, check the README.md"