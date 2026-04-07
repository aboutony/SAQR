const fs = require('fs');
const path = require('path');

const VALID_STATUSES = new Set(['draft', 'published', 'deprecated', 'retired']);
const VALID_SOURCE_FAMILIES = new Set(['cdc', 'nlp', 'cv', 'sentinel', 'manual']);
const VALID_EVENT_TYPES = new Set([
    'cdc.violation.detected',
    'nlp.drift.detected',
    'nlp.obligation.triggered',
    'cv.violation.detected',
    'sentinel.regulatory_update.detected',
    'workflow.manual.triggered',
]);
const VALID_OPERATORS = new Set(['equals', 'not_equals', 'in', 'gte', 'lte', 'contains', 'exists']);
const VALID_APPROVAL_MODES = new Set(['single', 'maker_checker', 'delegated', 'parallel_committee']);
const VALID_SELECTOR_TYPES = new Set(['user', 'role', 'queue']);
const VALID_APPROVAL_REJECTION_MODES = new Set(['first_rejection', 'quorum_impossible', 'return_to_remediation']);
const VALID_ESCALATION_TRIGGER_CONDITIONS = new Set(['sla_warning', 'sla_breach', 'approval_rejected', 'manual_escalation']);
const VALID_ESCALATION_TARGET_TYPES = new Set(['user', 'role', 'queue', 'webhook']);
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const ENTITY_SCOPE_FIELDS = new Set(['groupId', 'entityId', 'businessUnitId', 'siteId', 'siloId']);
const STEP_RULES = {
    assign: {
        allowedActionTypes: new Set(['route_to_queue', 'assign_actor']),
        requiredTransitions: ['onSuccess'],
    },
    approve: {
        allowedActionTypes: new Set(['request_approval']),
        requiredFields: ['approvalPolicyRef'],
        requiredTransitions: ['onApprove', 'onReject'],
    },
    remediate: {
        allowedActionTypes: new Set(['request_remediation', 'create_external_task']),
        requiredTransitions: ['onSuccess'],
    },
    verify: {
        allowedActionTypes: new Set(['request_verification']),
        requiredTransitions: ['onSuccess'],
    },
    notify: {
        allowedActionTypes: new Set(['emit_notification']),
        requiredTransitions: ['onSuccess'],
    },
    wait_timer: {
        allowedActionTypes: new Set(['pause_until_deadline']),
        requiredFields: ['timerDurationMinutes'],
        requiredTransitions: ['onElapsed'],
    },
    invoke_webhook: {
        allowedActionTypes: new Set(['invoke_delivery_webhook']),
        requiredTransitions: ['onSuccess'],
    },
    create_task: {
        allowedActionTypes: new Set(['create_external_task']),
        requiredTransitions: ['onSuccess'],
    },
    collect_evidence: {
        allowedActionTypes: new Set(['attach_evidence_link']),
        requiredTransitions: ['onSuccess'],
    },
};

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function collectUniqueKeys(items, keyField, pushError, label) {
    const keys = new Set();
    items.forEach((item, index) => {
        const keyValue = item && item[keyField];
        if (typeof keyValue !== 'string' || keyValue.trim() === '') {
            pushError(`${label} at index ${index} is missing non-empty "${keyField}"`);
            return;
        }
        if (keys.has(keyValue)) {
            pushError(`duplicate ${label} key "${keyValue}"`);
            return;
        }
        keys.add(keyValue);
    });
    return keys;
}

function validateSelectors(selectors, pushError, label, { allowEmpty = false } = {}) {
    if (!Array.isArray(selectors)) {
        pushError(`${label} must be an array`);
        return;
    }

    if (!allowEmpty && selectors.length === 0) {
        pushError(`${label} must include at least one selector`);
        return;
    }

    selectors.forEach((selector, index) => {
        if (!isObject(selector)) {
            pushError(`${label} selector ${index} must be an object`);
            return;
        }

        if (!VALID_SELECTOR_TYPES.has(selector.type)) {
            pushError(`${label} selector ${index} uses unsupported type "${selector.type}"`);
        }

        if (typeof selector.value !== 'string' || selector.value.trim() === '') {
            pushError(`${label} selector ${index} must include a non-empty value`);
        }
    });
}

function validateTrigger(trigger, index, triggerKeys, pushError) {
    if (!isObject(trigger)) {
        pushError(`trigger at index ${index} must be an object`);
        return;
    }

    if (typeof trigger.triggerKey !== 'string' || !triggerKeys.has(trigger.triggerKey)) {
        pushError(`trigger at index ${index} must include a valid triggerKey`);
    }

    if (!Array.isArray(trigger.sourceFamilies) || trigger.sourceFamilies.length === 0) {
        pushError(`trigger "${trigger.triggerKey || index}" must declare at least one source family`);
    } else {
        for (const sourceFamily of trigger.sourceFamilies) {
            if (!VALID_SOURCE_FAMILIES.has(sourceFamily)) {
                pushError(`trigger "${trigger.triggerKey || index}" contains unsupported sourceFamily "${sourceFamily}"`);
            }
        }
    }

    if (!Array.isArray(trigger.eventTypes) || trigger.eventTypes.length === 0) {
        pushError(`trigger "${trigger.triggerKey || index}" must declare at least one event type`);
    } else {
        for (const eventType of trigger.eventTypes) {
            if (!VALID_EVENT_TYPES.has(eventType)) {
                pushError(`trigger "${trigger.triggerKey || index}" contains unsupported eventType "${eventType}"`);
            }
        }
    }

    if (!Array.isArray(trigger.matchRules) || trigger.matchRules.length === 0) {
        pushError(`trigger "${trigger.triggerKey || index}" must declare at least one match rule`);
    } else {
        trigger.matchRules.forEach((rule, ruleIndex) => {
            if (!isObject(rule)) {
                pushError(`trigger "${trigger.triggerKey || index}" matchRule ${ruleIndex} must be an object`);
                return;
            }
            if (typeof rule.field !== 'string' || rule.field.trim() === '') {
                pushError(`trigger "${trigger.triggerKey || index}" matchRule ${ruleIndex} must include field`);
            }
            if (!VALID_OPERATORS.has(rule.operator)) {
                pushError(`trigger "${trigger.triggerKey || index}" matchRule ${ruleIndex} uses unsupported operator "${rule.operator}"`);
            }
            if (!('value' in rule)) {
                pushError(`trigger "${trigger.triggerKey || index}" matchRule ${ruleIndex} must include value`);
            }
        });
    }
}

function validateApprovalPolicies(policies, pushError) {
    policies.forEach((policy) => {
        if (!VALID_APPROVAL_MODES.has(policy.mode)) {
            pushError(`approval policy "${policy.approvalPolicyKey}" uses unsupported mode "${policy.mode}"`);
        }
        if (!isPositiveInteger(policy.minimumApprovals)) {
            pushError(`approval policy "${policy.approvalPolicyKey}" must use a positive integer minimumApprovals`);
        }
        validateSelectors(policy.approverSelectors, pushError, `approval policy "${policy.approvalPolicyKey}" approverSelectors`);
        if ('delegateSelectors' in policy) {
            validateSelectors(policy.delegateSelectors, pushError, `approval policy "${policy.approvalPolicyKey}" delegateSelectors`, {
                allowEmpty: true,
            });
        }
        if ('committeeSelectors' in policy) {
            validateSelectors(policy.committeeSelectors, pushError, `approval policy "${policy.approvalPolicyKey}" committeeSelectors`, {
                allowEmpty: true,
            });
        }
        if ('quorumMode' in policy && policy.quorumMode !== 'fixed') {
            pushError(`approval policy "${policy.approvalPolicyKey}" must use quorumMode "fixed" when provided`);
        }
        if ('rejectionMode' in policy && !VALID_APPROVAL_REJECTION_MODES.has(policy.rejectionMode)) {
            pushError(`approval policy "${policy.approvalPolicyKey}" uses unsupported rejectionMode "${policy.rejectionMode}"`);
        }
        if (policy.mode === 'maker_checker' && !isObject(policy.makerCheckerScope) && !isObject(policy.segregationOfDuties)) {
            pushError(`approval policy "${policy.approvalPolicyKey}" must include makerCheckerScope or segregationOfDuties for maker_checker mode`);
        }
        if ('makerCheckerScope' in policy && !isObject(policy.makerCheckerScope)) {
            pushError(`approval policy "${policy.approvalPolicyKey}" makerCheckerScope must be an object when present`);
        }
        if (isObject(policy.makerCheckerScope)) {
            Object.entries(policy.makerCheckerScope).forEach(([key, value]) => {
                if (typeof value !== 'boolean') {
                    pushError(`approval policy "${policy.approvalPolicyKey}" makerCheckerScope "${key}" must be a boolean`);
                }
            });
        }
        if (policy.mode === 'parallel_committee' && policy.quorumMode && policy.quorumMode !== 'fixed') {
            pushError(`approval policy "${policy.approvalPolicyKey}" parallel_committee mode requires quorumMode "fixed"`);
        }
    });
}

function validateSlaPolicies(policies, pushError) {
    policies.forEach((policy) => {
        if (!isPositiveInteger(policy.targetDurationMinutes)) {
            pushError(`SLA policy "${policy.slaPolicyKey}" must use a positive integer targetDurationMinutes`);
        }
        if (!isPositiveInteger(policy.breachDurationMinutes)) {
            pushError(`SLA policy "${policy.slaPolicyKey}" must use a positive integer breachDurationMinutes`);
        }
        if ('warningDurationMinutes' in policy && !isPositiveInteger(policy.warningDurationMinutes)) {
            pushError(`SLA policy "${policy.slaPolicyKey}" warningDurationMinutes must be a positive integer when present`);
        }
        if ('breachSeverityOverride' in policy && !VALID_SEVERITIES.has(policy.breachSeverityOverride)) {
            pushError(`SLA policy "${policy.slaPolicyKey}" breachSeverityOverride is invalid`);
        }
        if ('reminderIntervalsMinutes' in policy) {
            if (!Array.isArray(policy.reminderIntervalsMinutes) || policy.reminderIntervalsMinutes.some(item => !isPositiveInteger(item))) {
                pushError(`SLA policy "${policy.slaPolicyKey}" reminderIntervalsMinutes must be an array of positive integers`);
            }
        }
        if ('pauseStates' in policy) {
            if (!Array.isArray(policy.pauseStates) || policy.pauseStates.some(item => typeof item !== 'string' || item.trim() === '')) {
                pushError(`SLA policy "${policy.slaPolicyKey}" pauseStates must be an array of non-empty strings`);
            }
        }
    });
}

function validateEscalationPolicies(policies, pushError) {
    policies.forEach((policy) => {
        if (typeof policy.triggerCondition !== 'string' || policy.triggerCondition.trim() === '') {
            pushError(`escalation policy "${policy.escalationPolicyKey}" must declare triggerCondition`);
        } else if (!VALID_ESCALATION_TRIGGER_CONDITIONS.has(policy.triggerCondition)) {
            pushError(`escalation policy "${policy.escalationPolicyKey}" uses unsupported triggerCondition "${policy.triggerCondition}"`);
        }
        if (!VALID_ESCALATION_TARGET_TYPES.has(policy.targetType)) {
            pushError(`escalation policy "${policy.escalationPolicyKey}" uses unsupported targetType "${policy.targetType}"`);
        }
        if (typeof policy.targetRef !== 'string' || policy.targetRef.trim() === '') {
            pushError(`escalation policy "${policy.escalationPolicyKey}" must declare targetRef`);
        }
        if ('severityOverride' in policy && !VALID_SEVERITIES.has(policy.severityOverride)) {
            pushError(`escalation policy "${policy.escalationPolicyKey}" severityOverride is invalid`);
        }
    });
}

function validateAssignmentRule(rule, stepKey, pushError) {
    if (!isObject(rule)) {
        pushError(`step "${stepKey}" assignmentRule must be an object`);
        return;
    }

    if ('selectors' in rule) {
        validateSelectors(rule.selectors, pushError, `step "${stepKey}" assignmentRule.selectors`);
        return;
    }

    const legacyFields = ['actorId', 'role', 'queue'].filter(field => typeof rule[field] === 'string' && rule[field].trim() !== '');
    if (legacyFields.length === 0) {
        pushError(`step "${stepKey}" assignmentRule must declare selectors or one legacy target field`);
    }
    if (legacyFields.length > 1) {
        pushError(`step "${stepKey}" assignmentRule legacy target fields must be mutually exclusive`);
    }
}

function validateStep(step, index, stepKeys, approvalPolicyKeys, slaPolicyKeys, escalationPolicyKeys, pushError) {
    if (!isObject(step)) {
        pushError(`step at index ${index} must be an object`);
        return;
    }

    if (typeof step.stepKey !== 'string' || !stepKeys.has(step.stepKey)) {
        pushError(`step at index ${index} must include a valid stepKey`);
    }

    if (!isPositiveInteger(step.order)) {
        pushError(`step "${step.stepKey || index}" must have a positive integer order`);
    }

    if (typeof step.name !== 'string' || step.name.trim() === '') {
        pushError(`step "${step.stepKey || index}" must include a non-empty name`);
    }

    const rule = STEP_RULES[step.stepType];
    if (!rule) {
        pushError(`step "${step.stepKey || index}" uses unsupported stepType "${step.stepType}"`);
        return;
    }

    if (!rule.allowedActionTypes.has(step.actionType)) {
        pushError(`step "${step.stepKey || index}" actionType "${step.actionType}" is invalid for stepType "${step.stepType}"`);
    }

    for (const field of rule.requiredFields || []) {
        if (!(field in step)) {
            pushError(`step "${step.stepKey || index}" is missing required field "${field}" for stepType "${step.stepType}"`);
        }
    }

    if ('timerDurationMinutes' in step && !isPositiveInteger(step.timerDurationMinutes)) {
        pushError(`step "${step.stepKey || index}" timerDurationMinutes must be a positive integer`);
    }

    if ('approvalPolicyRef' in step && !approvalPolicyKeys.has(step.approvalPolicyRef)) {
        pushError(`step "${step.stepKey || index}" references unknown approvalPolicyRef "${step.approvalPolicyRef}"`);
    }

    if ('slaPolicyRef' in step && !slaPolicyKeys.has(step.slaPolicyRef)) {
        pushError(`step "${step.stepKey || index}" references unknown slaPolicyRef "${step.slaPolicyRef}"`);
    }

    if ('escalationPolicyRefs' in step) {
        if (!Array.isArray(step.escalationPolicyRefs)) {
            pushError(`step "${step.stepKey || index}" escalationPolicyRefs must be an array`);
        } else {
            for (const escalationKey of step.escalationPolicyRefs) {
                if (!escalationPolicyKeys.has(escalationKey)) {
                    pushError(`step "${step.stepKey || index}" references unknown escalationPolicyRef "${escalationKey}"`);
                }
            }
        }
    }

    if ('assignmentRule' in step) {
        validateAssignmentRule(step.assignmentRule, step.stepKey || index, pushError);
    }

    if (!isObject(step.transitions)) {
        pushError(`step "${step.stepKey || index}" must include transitions`);
        return;
    }

    for (const outcome of rule.requiredTransitions) {
        if (!(outcome in step.transitions)) {
            pushError(`step "${step.stepKey || index}" must declare transition "${outcome}"`);
        }
    }
}

function validateStepOrdering(steps, entryStepKey, pushError) {
    const orders = steps.map(step => step.order).filter(Number.isInteger).sort((a, b) => a - b);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
        pushError('step order values must be unique');
    }

    for (let index = 0; index < orders.length; index += 1) {
        if (orders[index] !== index + 1) {
            pushError('step order values must be contiguous starting at 1');
            break;
        }
    }

    const entryStep = steps.find(step => step.stepKey === entryStepKey);
    if (!entryStep) {
        pushError(`entryStepKey "${entryStepKey}" does not reference an existing step`);
        return;
    }

    if (entryStep.order !== 1) {
        pushError('entryStepKey must reference the step with order 1');
    }
}

function validateTransitions(steps, entryStepKey, pushError) {
    const stepKeySet = new Set(steps.map(step => step.stepKey));
    let hasTerminalTransition = false;

    for (const step of steps) {
        if (!isObject(step.transitions)) {
            continue;
        }

        for (const [outcome, target] of Object.entries(step.transitions)) {
            if (target === null) {
                hasTerminalTransition = true;
                continue;
            }

            if (typeof target !== 'string' || !stepKeySet.has(target)) {
                pushError(`step "${step.stepKey}" transition "${outcome}" must target an existing stepKey or null`);
            }
        }
    }

    if (!hasTerminalTransition) {
        pushError('at least one workflow transition must terminate with null');
    }

    const reachable = new Set();
    const queue = [entryStepKey];

    while (queue.length > 0) {
        const currentKey = queue.shift();
        if (!currentKey || reachable.has(currentKey) || !stepKeySet.has(currentKey)) {
            continue;
        }

        reachable.add(currentKey);
        const step = steps.find(item => item.stepKey === currentKey);
        if (!step || !isObject(step.transitions)) {
            continue;
        }

        for (const target of Object.values(step.transitions)) {
            if (typeof target === 'string' && !reachable.has(target)) {
                queue.push(target);
            }
        }
    }

    for (const step of steps) {
        if (!reachable.has(step.stepKey)) {
            pushError(`step "${step.stepKey}" is unreachable from entryStepKey "${entryStepKey}"`);
        }
    }
}

function validatePublishControls(publishControls, pushError) {
    if (!isObject(publishControls)) {
        pushError('publishControls must be an object');
        return;
    }

    if (typeof publishControls.changeSummary !== 'string' || publishControls.changeSummary.trim() === '') {
        pushError('publishControls.changeSummary must be a non-empty string');
    }

    if (typeof publishControls.approvalRecordRequired !== 'boolean') {
        pushError('publishControls.approvalRecordRequired must be a boolean');
    }

    if ('rollbackOfVersion' in publishControls && !isPositiveInteger(publishControls.rollbackOfVersion)) {
        pushError('publishControls.rollbackOfVersion must be a positive integer when present');
    }
}

function validateWorkflowDefinition(document, sourceName = '<memory>') {
    const errors = [];
    const pushError = (message) => errors.push(`${sourceName}: ${message}`);

    if (!isObject(document)) {
        pushError('workflow document must be an object');
        return errors;
    }

    const requiredTopLevel = ['schemaVersion', 'workflowKey', 'version', 'name', 'status', 'entryStepKey', 'triggers', 'steps', 'publishControls'];
    for (const field of requiredTopLevel) {
        if (!(field in document)) {
            pushError(`missing required top-level field "${field}"`);
        }
    }

    if (document.schemaVersion !== 1) {
        pushError('schemaVersion must equal 1');
    }

    if (typeof document.workflowKey !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(document.workflowKey)) {
        pushError('workflowKey must be a non-empty slug using lowercase letters, digits, and hyphens');
    }

    if (!isPositiveInteger(document.version)) {
        pushError('version must be a positive integer');
    }

    if (typeof document.name !== 'string' || document.name.trim() === '') {
        pushError('name must be a non-empty string');
    }

    if (!VALID_STATUSES.has(document.status)) {
        pushError('status must be one of draft, published, deprecated, or retired');
    }

    if ('defaultSeverity' in document && !VALID_SEVERITIES.has(document.defaultSeverity)) {
        pushError('defaultSeverity must be one of critical, high, medium, low, or info');
    }

    if ('entityScopeTemplate' in document) {
        if (!isObject(document.entityScopeTemplate)) {
            pushError('entityScopeTemplate must be an object when provided');
        } else {
            for (const key of Object.keys(document.entityScopeTemplate)) {
                if (!ENTITY_SCOPE_FIELDS.has(key)) {
                    pushError(`entityScopeTemplate contains unsupported field "${key}"`);
                }
            }
        }
    }

    const approvalPolicies = Array.isArray(document.approvalPolicies) ? document.approvalPolicies : [];
    const slaPolicies = Array.isArray(document.slaPolicies) ? document.slaPolicies : [];
    const escalationPolicies = Array.isArray(document.escalationPolicies) ? document.escalationPolicies : [];

    const approvalPolicyKeys = collectUniqueKeys(approvalPolicies, 'approvalPolicyKey', pushError, 'approval policy');
    const slaPolicyKeys = collectUniqueKeys(slaPolicies, 'slaPolicyKey', pushError, 'SLA policy');
    const escalationPolicyKeys = collectUniqueKeys(escalationPolicies, 'escalationPolicyKey', pushError, 'escalation policy');

    validateApprovalPolicies(approvalPolicies, pushError);
    validateSlaPolicies(slaPolicies, pushError);
    validateEscalationPolicies(escalationPolicies, pushError);

    const triggerKeys = Array.isArray(document.triggers)
        ? collectUniqueKeys(document.triggers, 'triggerKey', pushError, 'trigger')
        : new Set();
    const stepKeys = Array.isArray(document.steps)
        ? collectUniqueKeys(document.steps, 'stepKey', pushError, 'step')
        : new Set();

    if (!Array.isArray(document.triggers) || document.triggers.length === 0) {
        pushError('at least one trigger is required');
    } else {
        document.triggers.forEach((trigger, index) => validateTrigger(trigger, index, triggerKeys, pushError));
    }

    if (!Array.isArray(document.steps) || document.steps.length === 0) {
        pushError('at least one step is required');
    } else {
        document.steps.forEach((step, index) => validateStep(step, index, stepKeys, approvalPolicyKeys, slaPolicyKeys, escalationPolicyKeys, pushError));
        validateStepOrdering(document.steps, document.entryStepKey, pushError);
        validateTransitions(document.steps, document.entryStepKey, pushError);
    }

    validatePublishControls(document.publishControls, pushError);

    return errors;
}

function loadWorkflowDefinition(filePath) {
    const absolutePath = path.resolve(filePath);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

module.exports = {
    loadWorkflowDefinition,
    validateWorkflowDefinition,
};
