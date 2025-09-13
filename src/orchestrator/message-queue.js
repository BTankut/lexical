const { EventEmitter } = require('events');
const PQueue = require('p-queue').default;
const { logger } = require('../utils/logger.js');

class MessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.queue = new PQueue({
      concurrency: options.concurrency || 1,
      interval: options.interval || 1000,
      intervalCap: options.intervalCap || 10
    });
    this.messages = [];
    this.messageId = 0;
  }

  async enqueue(message, priority = 0) {
    const id = ++this.messageId;
    const messageObj = {
      id,
      message,
      priority,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.messages.push(messageObj);
    logger.debug(`Message ${id} enqueued with priority ${priority}`);

    return this.queue.add(
      async () => {
        try {
          messageObj.status = 'processing';
          this.emit('processing', messageObj);

          // Process the message
          const result = await this.processMessage(messageObj);

          messageObj.status = 'completed';
          messageObj.result = result;
          this.emit('completed', messageObj);

          return result;
        } catch (error) {
          messageObj.status = 'failed';
          messageObj.error = error;
          this.emit('failed', messageObj);
          throw error;
        }
      },
      { priority }
    );
  }

  async processMessage(messageObj) {
    // Override this method in subclasses for specific processing logic
    logger.info(`Processing message ${messageObj.id}`);
    return messageObj.message;
  }

  async flush() {
    logger.info('Flushing message queue');
    await this.queue.onIdle();
    logger.info('Message queue flushed');
  }

  pause() {
    this.queue.pause();
    logger.info('Message queue paused');
  }

  resume() {
    this.queue.start();
    logger.info('Message queue resumed');
  }

  clear() {
    this.queue.clear();
    this.messages = this.messages.filter(m => m.status === 'processing');
    logger.info('Message queue cleared');
  }

  getStatus() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
      messages: this.messages.map(m => ({
        id: m.id,
        status: m.status,
        priority: m.priority,
        timestamp: m.timestamp
      }))
    };
  }

  async waitForCompletion(messageId) {
    return new Promise((resolve, reject) => {
      const message = this.messages.find(m => m.id === messageId);

      if (!message) {
        reject(new Error(`Message ${messageId} not found`));
        return;
      }

      if (message.status === 'completed') {
        resolve(message.result);
        return;
      }

      if (message.status === 'failed') {
        reject(message.error);
        return;
      }

      // Wait for completion
      const completedHandler = (completedMessage) => {
        if (completedMessage.id === messageId) {
          this.removeListener('failed', failedHandler);
          resolve(completedMessage.result);
        }
      };

      const failedHandler = (failedMessage) => {
        if (failedMessage.id === messageId) {
          this.removeListener('completed', completedHandler);
          reject(failedMessage.error);
        }
      };

      this.once('completed', completedHandler);
      this.once('failed', failedHandler);
    });
  }
}

class TaskQueue extends MessageQueue {
  constructor(orchestrator, options = {}) {
    super(options);
    this.orchestrator = orchestrator;
  }

  async processMessage(messageObj) {
    const task = messageObj.message;
    logger.info(`Processing task ${task.id}: ${task.description}`);

    try {
      // Execute through orchestrator's executor
      const result = await this.orchestrator.executor.execute(task);

      // Validate result if needed
      if (this.orchestrator.config.validateResults) {
        const validation = await this.orchestrator.planner.validateResult(result);
        if (!validation.approved) {
          throw new Error(`Validation failed: ${validation.reason}`);
        }
      }

      return result;
    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);
      throw error;
    }
  }

  async enqueueTasks(tasks, priority = 0) {
    const promises = tasks.map(task =>
      this.enqueue(task, task.priority || priority)
    );
    return Promise.all(promises);
  }
}

module.exports = { MessageQueue, TaskQueue };