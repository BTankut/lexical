class AgentRegistry {
    constructor() {
        this.agents = new Map();
    }

    /**
     * Registers a new agent.
     * @param {string} name - The name of the agent.
     * @param {object} agent - The agent object.
     * @param {string[]} capabilities - An array of capabilities the agent possesses.
     */
    register(name, agent, capabilities) {
        if (this.agents.has(name)) {
            throw new Error(`Agent with name "${name}" is already registered.`);
        }
        this.agents.set(name, { agent, capabilities });
    }

    /**
     * Retrieves an agent by name.
     * @param {string} name - The name of the agent to retrieve.
     * @returns {object|undefined} The agent object or undefined if not found.
     */
    getAgent(name) {
        const registeredAgent = this.agents.get(name);
        return registeredAgent ? registeredAgent.agent : undefined;
    }

    /**
     * Calculates a score based on how well an agent's capabilities match the requirements.
     * @param {object} capabilities - The capabilities object with scoring.
     * @param {object} requirements - The requirements object.
     * @returns {number} The calculated score.
     */
    calculateScore(capabilities, requirements) {
        if (!requirements) {
            return 1; // Default score
        }

        let score = 0;

        // Role capability scoring (most important)
        if (requirements.role && capabilities[requirements.role]) {
            score += capabilities[requirements.role] * 10;
        }

        // Language preference
        if (requirements.language && capabilities.languages?.includes(requirements.language)) {
            score += 5;
        }

        // Context window requirement
        if (requirements.contextSize && capabilities.contextWindow >= requirements.contextSize) {
            score += 3;
        }

        // Task complexity
        if (requirements.complexity) {
            if (requirements.complexity === 'high' && capabilities.planning > 0.9) {
                score += 2;
            } else if (requirements.complexity === 'low' && capabilities.execution > 0.9) {
                score += 2;
            }
        }

        return score;
    }

    /**
     * Selects the best agent based on a set of requirements.
     * @param {string[]} requirements - An array of required capabilities.
     * @returns {object|null} The best-suited agent or null if no agents are registered.
     */
    selectBestAgent(requirements) {
        if (this.agents.size === 0) {
            return null;
        }

        let bestAgent = null;
        let highestScore = -1;

        for (const [name, { agent, capabilities }] of this.agents.entries()) {
            const score = this.calculateScore(capabilities, requirements);
            if (score > highestScore) {
                highestScore = score;
                bestAgent = agent;
            }
        }

        // If no agent has any matching capabilities, return the first registered agent as a default.
        if (bestAgent === null) {
            return this.agents.values().next().value.agent;
        }

        return bestAgent;
    }
}

module.exports = AgentRegistry;