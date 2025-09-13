// Test setup and configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock timers for cache tests
global.setTimeout = jest.fn(global.setTimeout);
global.clearTimeout = jest.fn(global.clearTimeout);

// Clean up after tests
afterAll(() => {
  // Clean up any lingering processes
  if (global.orchestrator) {
    global.orchestrator.shutdown();
  }
});