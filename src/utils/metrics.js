const { logger } = require('./logger.js');

class Metrics {
  constructor() {
    this.data = {
      requests: 0,
      successes: 0,
      failures: 0,
      latencies: [],
      taskTypes: {},
      errors: [],
      startTime: Date.now()
    };
  }

  recordRequest(duration, success, metadata = {}) {
    this.data.requests++;
    this.data.latencies.push(duration);

    // Keep only last 100 latencies to prevent memory growth
    if (this.data.latencies.length > 100) {
      this.data.latencies.shift();
    }

    if (success) {
      this.data.successes++;
    } else {
      this.data.failures++;
      if (metadata.error) {
        this.data.errors.push({
          error: metadata.error,
          timestamp: Date.now()
        });

        // Keep only last 50 errors
        if (this.data.errors.length > 50) {
          this.data.errors.shift();
        }
      }
    }

    // Track task types
    if (metadata.taskType) {
      this.data.taskTypes[metadata.taskType] =
        (this.data.taskTypes[metadata.taskType] || 0) + 1;
    }

    logger.debug(`Metrics recorded: ${success ? 'success' : 'failure'}, duration: ${duration}ms`);
  }

  getStats() {
    const latencies = this.data.latencies;
    const totalRequests = this.data.requests;

    if (latencies.length === 0) {
      return {
        ...this.data,
        averageLatency: 0,
        medianLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        successRate: 0,
        uptime: this.getUptime()
      };
    }

    // Calculate statistics
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return {
      ...this.data,
      averageLatency: Math.round(avg),
      medianLatency: median,
      minLatency: min,
      maxLatency: max,
      successRate: totalRequests > 0
        ? ((this.data.successes / totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      uptime: this.getUptime()
    };
  }

  getUptime() {
    const uptimeMs = Date.now() - this.data.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const seconds = Math.floor((uptimeMs % 60000) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  reset() {
    this.data = {
      requests: 0,
      successes: 0,
      failures: 0,
      latencies: [],
      taskTypes: {},
      errors: [],
      startTime: Date.now()
    };
    logger.info('Metrics reset');
  }

  getReport() {
    const stats = this.getStats();

    return `
=== Orchestrator Metrics Report ===
Uptime: ${stats.uptime}
Total Requests: ${stats.requests}
Successful: ${stats.successes}
Failed: ${stats.failures}
Success Rate: ${stats.successRate}

=== Latency Statistics ===
Average: ${stats.averageLatency}ms
Median: ${stats.medianLatency}ms
Min: ${stats.minLatency}ms
Max: ${stats.maxLatency}ms

=== Task Types ===
${Object.entries(stats.taskTypes)
  .map(([type, count]) => `${type}: ${count}`)
  .join('\n')}

=== Recent Errors (last 5) ===
${stats.errors.slice(-5)
  .map(e => `- ${new Date(e.timestamp).toISOString()}: ${e.error}`)
  .join('\n') || 'No errors'}
`;
  }
}

// Singleton instance
let metricsInstance = null;

function getMetrics() {
  if (!metricsInstance) {
    metricsInstance = new Metrics();
  }
  return metricsInstance;
}

module.exports = { Metrics, getMetrics };