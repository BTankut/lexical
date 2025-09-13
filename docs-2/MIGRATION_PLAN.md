# Universal CLI Migration Plan

## Overview
Transform the current fixed-role system (Claude=planner, Gemini=executor) into a flexible, universal architecture where any CLI can perform any role.

## Core Principle
**Minimal changes, maximum flexibility** - Keep all existing cache, metrics, and retry logic intact.

## Migration Steps

### Phase 1: Universal CLI Wrapper (Week 1)
**Goal**: Merge executor.js and planner.js into universal-cli.js

1. Create universal-cli.js that can handle any CLI
2. Support role-based prompt preparation
3. Maintain compatibility with existing orchestrator
4. Test with both Claude and Gemini

### Phase 2: Multi-Agent Orchestrator (Week 2)
**Goal**: Extend orchestrator to support multiple agents

1. Add agents registry to orchestrator
2. Implement agent selection logic
3. Support parallel execution
4. Keep existing cache/metrics working

### Phase 3: Workflow System (Week 3)
**Goal**: Config-driven workflow definitions

1. Create workflow configuration schema
2. Implement workflow executor
3. Add workflow validation
4. Support dynamic workflow adaptation

### Phase 4: MCP Tools Extension (Week 4)
**Goal**: New MCP tools for workflow control

1. Add workflow selection tools
2. Implement agent preference tools
3. Add parallel execution tools
4. Backward compatibility with existing tools

### Phase 5: Testing & Migration (Week 5)
**Goal**: Complete migration and testing

1. Migrate existing code to new architecture
2. Test all workflows
3. Performance benchmarking
4. Documentation update

## Success Criteria

- ✅ Any CLI can be planner or executor
- ✅ User can specify workflow via MCP
- ✅ Cache/metrics continue working
- ✅ No breaking changes to existing API
- ✅ Performance same or better
- ✅ Easy to add new CLIs

## Risk Mitigation

1. **Keep old files during transition** - Don't delete executor.js/planner.js immediately
2. **Feature flags** - Use config to enable/disable new features
3. **Incremental rollout** - Test each phase thoroughly
4. **Rollback plan** - Keep git tags for each phase

## Timeline

- Week 1: Universal CLI implementation
- Week 2: Multi-agent support
- Week 3: Workflow system
- Week 4: MCP tools
- Week 5: Testing and rollout

Total: 5 weeks for complete migration