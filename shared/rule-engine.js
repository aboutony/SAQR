const { assertProviderContract } = require('./provider-contract');

function normaliseFindings(result) {
    if (Array.isArray(result)) {
        return result.filter(Boolean);
    }

    if (result) {
        return [result];
    }

    return [];
}

function createRuleEngine({ domain, rulesets }) {
    if (!Array.isArray(rulesets) || rulesets.length === 0) {
        throw new Error(`${domain} rule engine requires at least one ruleset`);
    }

    const validatedRuleSets = rulesets.map((ruleset, index) => (
        assertProviderContract(`${domain}.ruleset[${index}]`, ruleset, ['supports', 'evaluate'])
    ));

    return {
        evaluate(context) {
            const findings = [];

            for (const ruleset of validatedRuleSets) {
                if (!ruleset.supports(context)) {
                    continue;
                }

                findings.push(...normaliseFindings(ruleset.evaluate(context)));
            }

            return findings;
        },

        getRuleSets() {
            return [...validatedRuleSets];
        },
    };
}

module.exports = {
    createRuleEngine,
    normaliseFindings,
};
