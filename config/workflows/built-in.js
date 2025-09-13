const workflows = {
  direct: {
    name: 'Direct Execution',
    description: 'A single-step workflow where the task is executed directly by an automatically selected agent.',
    steps: [
      {
        name: 'Execute Task',
        description: 'Directly execute the user\'s request.',
        agent: 'auto',
      },
    ],
  },
  'plan-execute': {
    name: 'Plan and Execute',
    description: 'A two-step workflow where one agent plans and another executes.',
    steps: [
      {
        name: 'Plan',
        description: 'Create a step-by-step plan to address the user\'s request.',
        agent: 'claude',
        next_step: 'Execute',
      },
      {
        name: 'Execute',
        description: 'Execute the plan created in the previous step.',
        agent: 'gemini',
      },
    ],
  },
  competitive: {
    name: 'Competitive Execution',
    description: 'Both agents execute the task in parallel, and the best result is chosen.',
    steps: [
      {
        name: 'Parallel Execution',
        description: 'Claude and Gemini execute the user\'s request simultaneously.',
        parallel: [
          {
            agent: 'claude',
          },
          {
            agent: 'gemini',
          },
        ],
      },
    ],
  },
  iterative: {
    name: 'Iterative Refinement',
    description: 'An iterative loop of executing, reviewing, and refining the task until completion.',
    steps: [
      {
        name: 'Execute',
        description: 'Initial execution of the task.',
        agent: 'auto',
        next_step: 'Review',
      },
      {
        name: 'Review',
        description: 'Review the output of the execution step.',
        agent: 'claude',
        next_step: 'Refine',
      },
      {
        name: 'Refine',
        description: 'Refine the task based on the review. This step can loop back to Execute.',
        agent: 'gemini',
        loop_to: 'Execute',
      },
    ],
  },
};

module.exports = workflows;