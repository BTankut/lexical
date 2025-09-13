// src/cli/templates/prompts.js

const templates = {
  plan: {
    claude: (prompt) => `Create a detailed execution plan for: ${prompt}\nProvide step-by-step tasks as JSON`,
    gemini: (prompt) => `${prompt}\nCreate a structured plan with clear steps`
  },
  execute: {
    claude: (prompt) => `Write code for: ${prompt}\nBe concise and efficient`,
    gemini: (prompt) => prompt
  },
  review: {
    claude: (prompt) => `Review and improve: ${prompt}\nFocus on quality and best practices`,
    gemini: (prompt) => `Review this: ${prompt}`
  }
};

function preparePrompt(prompt, role, cliName) {
  if (templates[role] && templates[role][cliName]) {
    return templates[role][cliName](prompt);
  }
  // Default fallback if role or cliName is not found
  return prompt;
}

module.exports = {
  preparePrompt
};
