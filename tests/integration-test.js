const UniversalCLI = require('../src/cli/universal-cli');
const { MultiAgentOrchestrator } = require('../src/orchestrator');
const WorkflowEngine = require('../src/workflow/workflow-engine');

async function runTests() {
  console.log('INTEGRATION TESTS\n');
  let passed = 0, failed = 0;

  // Test 1: UniversalCLI
  try {
    const cli = new UniversalCLI({ name: 'gemini' });
    await cli.execute('test', { timeout: 10000 });
    console.log('✅ UniversalCLI');
    passed++;
  } catch {
    console.log('❌ UniversalCLI');
    failed++;
  }

  // Test 2: MultiAgentOrchestrator
  try {
    const orch = new MultiAgentOrchestrator({});
    await orch.executeWithAgent('gemini', 'test', { timeout: 10000 });
    console.log('✅ MultiAgentOrchestrator');
    passed++;
  } catch {
    console.log('❌ MultiAgentOrchestrator');
    failed++;
  }

  // Test 3: WorkflowEngine
  try {
    const orch = new MultiAgentOrchestrator({});
    const engine = new WorkflowEngine(orch);
    engine.workflows.set('test', {
      steps: [{ name: 'test', agent: 'gemini' }]
    });
    await engine.execute('test', 'test');
    console.log('✅ WorkflowEngine');
    passed++;
  } catch {
    console.log('❌ WorkflowEngine');
    failed++;
  }

  console.log(`\nRESULTS: ${passed}/${passed+failed} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
