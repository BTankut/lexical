// src/cli/configs/universal.js
module.exports = {
  name: 'universal',
  command: 'node',
  spawnArgs: ['/Users/btankut/Projects/Lexical-TUI-Claude/src/mcp-servers/universal-mcp-server.js'],
  inputMethod: 'stdin',
  outputFormat: 'json',
  capabilities: {
    planning: 0.9,
    execution: 0.9,
    review: 0.9
  }
};
