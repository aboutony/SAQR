const { assertProviderContract } = require('../../../shared/provider-contract');

const SELECTOR_TYPES = new Set(['user', 'role', 'queue']);

function clone(value) {
    return structuredClone(value);
}

function normaliseActor(actor) {
    if (!actor || typeof actor !== 'object') {
        return {
            actorType: 'external',
            actorId: 'unknown',
            displayName: 'Unknown Actor',
            roleKey: null,
            sourceSystem: null,
        };
    }

    return {
        actorType: actor.actorType || 'external',
        actorId: actor.actorId || 'unknown',
        displayName: actor.displayName || actor.actorId || 'Unknown Actor',
        roleKey: actor.roleKey || null,
        sourceSystem: actor.sourceSystem || null,
    };
}

function actorKey(actor) {
    const value = normaliseActor(actor);
    return `${value.actorType}:${value.actorId}`;
}

function actorsEqual(left, right) {
    return actorKey(left) === actorKey(right);
}

function dedupeActors(actors) {
    const seen = new Set();
    const output = [];

    actors.forEach((actor) => {
        const normalized = normaliseActor(actor);
        const key = actorKey(normalized);
        if (seen.has(key)) return;
        seen.add(key);
        output.push(normalized);
    });

    return output;
}

function normaliseSelector(selector) {
    if (!selector || typeof selector !== 'object') {
        throw new Error('selector must be an object');
    }

    const type = String(selector.type || '').trim();
    const value = String(selector.value || '').trim();
    if (!SELECTOR_TYPES.has(type)) {
        throw new Error(`unsupported selector type "${selector.type}"`);
    }
    if (!value) {
        throw new Error('selector value must be a non-empty string');
    }

    return {
        type,
        value,
        label: selector.label || null,
    };
}

function selectorsFromAssignmentRule(assignmentRule) {
    if (!assignmentRule || typeof assignmentRule !== 'object') {
        return [];
    }

    if (Array.isArray(assignmentRule.selectors)) {
        return assignmentRule.selectors.map(normaliseSelector);
    }

    if (assignmentRule.actorId) {
        return [{ type: 'user', value: String(assignmentRule.actorId) }];
    }

    if (assignmentRule.role) {
        return [{ type: 'role', value: String(assignmentRule.role) }];
    }

    if (assignmentRule.queue) {
        return [{ type: 'queue', value: String(assignmentRule.queue) }];
    }

    return [];
}

function normaliseActorInput(input, fallbackType = 'user') {
    if (typeof input === 'string') {
        return normaliseActor({
            actorType: fallbackType,
            actorId: input,
            displayName: input,
            roleKey: fallbackType === 'role' ? input : null,
        });
    }

    return normaliseActor(input);
}

function normaliseActorList(items, fallbackType = 'user') {
    return dedupeActors((items || []).map(item => normaliseActorInput(item, fallbackType)));
}

function buildLookup(entries = [], fallbackType = 'user') {
    const actors = normaliseActorList(entries, fallbackType);
    return new Map(actors.map(actor => [actorKey(actor), actor]));
}

function buildSelectorMap(mapping = {}, fallbackType = 'user') {
    const result = new Map();
    Object.entries(mapping || {}).forEach(([key, values]) => {
        result.set(String(key), normaliseActorList(values, fallbackType));
    });
    return result;
}

function createInMemoryActorDirectory({
    users = [],
    roles = {},
    queues = {},
    delegates = {},
} = {}) {
    const userLookup = buildLookup(users, 'user');
    const roleLookup = buildSelectorMap(roles, 'user');
    const queueLookup = buildSelectorMap(queues, 'user');
    const delegateLookup = buildSelectorMap(delegates, 'user');

    function resolveSelectors(selectors, context = {}) {
        const normalizedSelectors = (selectors || []).map(normaliseSelector);
        const resolved = [];

        normalizedSelectors.forEach((selector) => {
            if (selector.type === 'user') {
                const existing = userLookup.get(`user:${selector.value}`);
                resolved.push(existing || normaliseActor({
                    actorType: 'user',
                    actorId: selector.value,
                    displayName: selector.label || selector.value,
                }));
                return;
            }

            if (selector.type === 'role') {
                const roleActors = roleLookup.get(selector.value);
                if (roleActors && roleActors.length > 0) {
                    resolved.push(...roleActors);
                    return;
                }
                resolved.push(normaliseActor({
                    actorType: 'role',
                    actorId: selector.value,
                    displayName: selector.label || selector.value,
                    roleKey: selector.value,
                }));
                return;
            }

            if (selector.type === 'queue') {
                const queueActors = queueLookup.get(selector.value);
                if (queueActors && queueActors.length > 0) {
                    resolved.push(...queueActors);
                    return;
                }
                resolved.push(normaliseActor({
                    actorType: 'queue',
                    actorId: selector.value,
                    displayName: selector.label || selector.value,
                }));
            }
        });

        return dedupeActors(resolved);
    }

    function resolveDelegates(actor, selectors = [], context = {}) {
        const normalizedActor = normaliseActor(actor);
        const explicitDelegates = resolveSelectors(selectors, context);
        const mappedDelegates = delegateLookup.get(actorKey(normalizedActor)) || [];
        return dedupeActors([...mappedDelegates, ...explicitDelegates]);
    }

    function actorHasRole(actor, roleKey) {
        const normalizedActor = normaliseActor(actor);
        if (normalizedActor.roleKey === roleKey) {
            return true;
        }

        const roleActors = roleLookup.get(roleKey) || [];
        return roleActors.some(entry => actorsEqual(entry, normalizedActor));
    }

    return {
        resolveSelectors,
        resolveDelegates,
        actorHasRole,
    };
}

function ensureActorDirectory(provider) {
    return assertProviderContract('workflow actorDirectory', provider, [
        'resolveSelectors',
        'resolveDelegates',
        'actorHasRole',
    ]);
}

module.exports = {
    SELECTOR_TYPES,
    actorKey,
    actorsEqual,
    clone,
    createInMemoryActorDirectory,
    dedupeActors,
    ensureActorDirectory,
    normaliseActor,
    normaliseSelector,
    selectorsFromAssignmentRule,
};
