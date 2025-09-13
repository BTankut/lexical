const { execSync } = require('child_process');
const { logger } = require('./logger');

class ProcessMonitor {
  constructor() {
    this.activeProcesses = new Map();
    this.maxCpuUsage = 50; // Maximum allowed CPU %
    this.maxProcessAge = 300000; // 5 minutes max age
    this.checkInterval = 10000; // Check every 10 seconds
    this.monitoringActive = false;
  }

  startMonitoring() {
    if (this.monitoringActive) return;

    this.monitoringActive = true;
    logger.info('Process monitoring started');

    this.monitorTimer = setInterval(() => {
      this.checkProcessHealth();
    }, this.checkInterval);
  }

  stopMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitoringActive = false;
      logger.info('Process monitoring stopped');
    }
  }

  registerProcess(pid, name, metadata = {}) {
    this.activeProcesses.set(pid, {
      name,
      startTime: Date.now(),
      metadata,
      warnings: 0
    });
    logger.info(`Process registered: ${name} (PID: ${pid})`);
  }

  unregisterProcess(pid) {
    const process = this.activeProcesses.get(pid);
    if (process) {
      this.activeProcesses.delete(pid);
      logger.info(`Process unregistered: ${process.name} (PID: ${pid})`);
    }
  }

  checkProcessHealth() {
    try {
      // Get all node processes with CPU usage
      const output = execSync('ps aux | grep node | grep -v grep', { encoding: 'utf8' });
      const lines = output.split('\n').filter(line => line.trim());

      const highCpuProcesses = [];
      const longRunningProcesses = [];

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const pid = parseInt(parts[1]);
          const cpuUsage = parseFloat(parts[2]);
          const command = parts.slice(10).join(' ');

          // Check for high CPU usage
          if (cpuUsage > this.maxCpuUsage) {
            highCpuProcesses.push({ pid, cpuUsage, command });
          }

          // Check registered processes for age
          const processInfo = this.activeProcesses.get(pid);
          if (processInfo) {
            const age = Date.now() - processInfo.startTime;
            if (age > this.maxProcessAge) {
              longRunningProcesses.push({ pid, age, name: processInfo.name });
            }
          }
        }
      });

      // Handle high CPU processes
      highCpuProcesses.forEach(({ pid, cpuUsage, command }) => {
        logger.warn(`High CPU usage detected: ${cpuUsage}% PID:${pid} ${command}`);

        if (command.includes('gemini') || command.includes('jest')) {
          logger.error(`EMERGENCY: Killing runaway process PID:${pid} (${cpuUsage}% CPU)`);
          this.emergencyKill(pid);
        }
      });

      // Handle long-running processes
      longRunningProcesses.forEach(({ pid, age, name }) => {
        const ageMinutes = Math.round(age / 60000);
        logger.warn(`Long-running process: ${name} PID:${pid} (${ageMinutes} min)`);

        if (name.includes('gemini') || name.includes('test')) {
          logger.error(`TIMEOUT: Killing aged process ${name} PID:${pid}`);
          this.emergencyKill(pid);
        }
      });

    } catch (error) {
      logger.error('Process monitoring error:', error.message);
    }
  }

  emergencyKill(pid) {
    try {
      // First try graceful kill
      execSync(`kill ${pid}`, { stdio: 'ignore' });
      logger.info(`Graceful kill sent to PID:${pid}`);

      // Wait 2 seconds then force kill if still alive
      setTimeout(() => {
        try {
          execSync(`kill -0 ${pid}`, { stdio: 'ignore' });
          // Process still alive, force kill
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          logger.warn(`Force kill sent to PID:${pid}`);
        } catch {
          // Process already dead
          logger.info(`Process PID:${pid} terminated successfully`);
        }
        this.unregisterProcess(pid);
      }, 2000);

    } catch (error) {
      logger.error(`Failed to kill process PID:${pid}:`, error.message);
    }
  }

  getStats() {
    const activeCount = this.activeProcesses.size;
    const processes = Array.from(this.activeProcesses.entries()).map(([pid, info]) => ({
      pid,
      name: info.name,
      ageSeconds: Math.round((Date.now() - info.startTime) / 1000),
      warnings: info.warnings
    }));

    return {
      activeProcesses: activeCount,
      monitoringActive: this.monitoringActive,
      processes
    };
  }
}

// Singleton instance
const processMonitor = new ProcessMonitor();

module.exports = { ProcessMonitor, processMonitor };