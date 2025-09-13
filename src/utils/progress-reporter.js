const EventEmitter = require('events');

class ProgressReporter extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
  }

  startTask(taskId, description, totalSteps = 0) {
    const task = {
      id: taskId,
      description,
      totalSteps,
      currentStep: 0,
      status: 'running',
      startTime: Date.now(),
      messages: []
    };
    this.tasks.set(taskId, task);
    this.emit('taskStart', task);
    console.log(`[START] ${description}`);
    return taskId;
  }

  updateTask(taskId, step, message) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.currentStep = step;
    task.messages.push({ time: Date.now(), message });
    
    const progress = task.totalSteps > 0 
      ? `${step}/${task.totalSteps}` 
      : `Step ${step}`;
    
    console.log(`[${progress}] ${message}`);
    this.emit('taskProgress', task);
  }

  completeTask(taskId, result = null) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'completed';
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.result = result;
    
    console.log(`[DONE] ${task.description} (${task.duration}ms)`);
    this.emit('taskComplete', task);
    return task;
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'failed';
    task.endTime = Date.now();
    task.duration = task.endTime - task.startTime;
    task.error = error;
    
    console.log(`[FAIL] ${task.description}: ${error.message}`);
    this.emit('taskFail', task);
    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

module.exports = { ProgressReporter };
