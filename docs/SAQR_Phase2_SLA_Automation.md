# SAQR Phase 2 SLA Automation

Date: 2026-04-07
Scope: `P2-106`

## Purpose

This document closes `P2-106` by defining the SLA-monitoring, reminder, breach-handling, and escalation-automation behavior now implemented in the workflow engine.

This increment remains backend-only. No UI or UX changes were introduced.

## What Was Added

The SLA automation layer now lives inside:

- `services/workflow-engine/src/runtime-core.js`
- `services/workflow-engine/src/runtime.test.js`
- `docs/contracts/saqr-workflow-domain.yaml`
- `docs/contracts/saqr-workflow-dsl.yaml`

## Runtime Methods Now Available

The workflow engine now exposes:

- `evaluateInstanceSla(instanceId, { at, actor })`
- `runSlaAutomation({ at, actor })`

These are deterministic runtime methods intended for delivery-team orchestration later. They are not a background worker and they do not depend on any live scheduler in the repo.

## Implemented SLA Behavior

### Step-Local SLA State

When a step starts and references `slaPolicyRef`, the engine now creates step-local SLA state that tracks:

- warning threshold
- target threshold
- breach threshold
- reminder schedule
- pause windows
- breach severity override
- executed escalation records

### Reminder Evaluation

Reminder intervals are evaluated against effective elapsed time and emitted only once per interval.

Each reminder creates:

- `sla_reminder_sent` audit history
- incremented `reminderCount` on the step run

### Warning Evaluation

If `warningDurationMinutes` is reached, the engine records a one-time SLA warning and may trigger escalation policies bound to `sla_warning`.

### Breach Handling

If `breachDurationMinutes` is reached, the engine:

- records `sla_breach`
- applies `breachSeverityOverride` when configured
- moves the instance into `breached` unless automation routes it onward immediately
- executes escalation policies bound to `sla_breach`

### Pause-Aware Timing

Elapsed SLA time now stops when the current step or instance enters a state listed in `pauseStates`.

This is tracked through pause windows rather than raw wall-clock subtraction.

### Escalation Automation

When an escalation policy is triggered by SLA state, the engine can now:

- resolve user, role, or queue escalation targets
- emit `escalation_triggered` audit history
- escalate an approval step into a committee round when appropriate
- route to `nextStepOverride` automatically when configured

The current implementation is interface-ready only. It does not dispatch real email, SMS, or webhook notifications.

## Scope Boundary Preserved

This increment does not add:

- durable persistence
- a persistent scheduler or cron worker
- external notification delivery
- workflow APIs
- UI exposure

Those remain later Phase 2 work.

## Verification

The runtime tests now cover:

- deterministic reminder emission
- warning and breach evaluation
- pause-aware SLA monitoring
- automated escalation into a configured next step

Commands used:

```powershell
npm run phase2:workflow:validate
npm run phase2:workflow:test
npm run phase2:workflow:engine:test
npm run ui:baseline:check
```

## References

- Workflow execution engine: `docs/SAQR_Phase2_Workflow_Execution_Engine.md`
- Workflow DSL and validation: `docs/SAQR_Phase2_Workflow_DSL_and_Validation.md`
- Workflow domain contract: `docs/contracts/saqr-workflow-domain.yaml`
- Workflow DSL contract: `docs/contracts/saqr-workflow-dsl.yaml`
