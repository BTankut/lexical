// src/cli/configs/gemini.js
module.exports = {
  name: 'gemini',
  command: 'gemini',
  spawnArgs: ['--yolo'],
  inputMethod: 'args',  // Prompt as argument
  outputFormat: 'mixed',
  capabilities: {
    planning: 0.85,
    execution: 0.95,
    review: 0.80
  },
  envCleanup: ['GOOGLE_API_KEY'] // Remove duplicates
};