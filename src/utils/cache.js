const crypto = require('crypto');
const { logger } = require('./logger.js');

class ResponseCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 100; // Max cache entries
    this.hits = 0;
    this.misses = 0;
  }

  generateKey(request) {
    // Generate a unique key for the request
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(request));
    return hash.digest('hex');
  }

  set(key, value) {
    // Check cache size limit
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug(`Cache evicted oldest entry: ${firstKey}`);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
      created: Date.now(),
      hits: 0
    });

    logger.debug(`Cache set: ${key}`);
  }

  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      this.misses++;
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    // Update hit count
    item.hits++;
    this.hits++;
    logger.debug(`Cache hit: ${key} (hits: ${item.hits})`);

    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear() {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  cleanup() {
    // Remove expired entries
    let removed = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%',
      ttl: this.ttl
    };
  }

  // Start periodic cleanup
  startCleanupInterval(interval = 60000) { // Every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Task-specific cache for orchestrator
class TaskCache extends ResponseCache {
  constructor(options = {}) {
    super({
      ttl: options.ttl || 600000, // 10 minutes for tasks
      maxSize: options.maxSize || 50
    });
  }

  setTask(task, result) {
    const key = this.generateKey(task);
    this.set(key, {
      task,
      result,
      timestamp: Date.now()
    });
  }

  getTask(task) {
    const key = this.generateKey(task);
    return this.get(key);
  }

  getCachedResult(prompt) {
    // Check if we have a cached result for similar prompt
    for (const [key, item] of this.cache.entries()) {
      if (item.value.task && item.value.task.prompt === prompt) {
        if (Date.now() < item.expires) {
          logger.info(`Found cached result for prompt: ${prompt.substring(0, 50)}...`);
          return item.value.result;
        }
      }
    }
    return null;
  }
}

module.exports = { ResponseCache, TaskCache };