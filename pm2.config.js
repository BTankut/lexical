module.exports = {
  apps: [{
    name: 'gemini-executor-mcp',
    script: './src/mcp-servers/gemini-executor-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      EXECUTOR_TYPE: 'gemini',
      LOG_LEVEL: 'info'
    },
    env_development: {
      NODE_ENV: 'development',
      EXECUTOR_TYPE: 'gemini',
      LOG_LEVEL: 'debug'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',

    // Graceful shutdown
    kill_timeout: 5000,

    // Health monitoring
    min_uptime: '10s',
    max_restarts: 10,

    // Performance monitoring
    instance_var: 'INSTANCE_ID',
    exec_mode: 'fork'
  }]
};