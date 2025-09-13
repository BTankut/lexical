// src/cli/configs/claude.js
module.exports = {
  name: 'claude',
  command: 'claude',
  spawnArgs: ['--print', '--dangerously-skip-permissions'],
  inputMethod: 'stdin',
  outputFormat: 'text',
  capabilities: {
    planning: 0.95,
    execution: 0.85,
    review: 0.90
  }
};