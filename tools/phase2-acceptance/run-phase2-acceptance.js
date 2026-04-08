#!/usr/bin/env node

const { runAllScenarios, runScenario } = require('./harness');

function parseArgs(argv) {
    const parsed = {
        scenario: 'all',
        json: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--scenario' && argv[index + 1]) {
            parsed.scenario = argv[index + 1];
            index += 1;
            continue;
        }
        if (token === '--json') {
            parsed.json = true;
        }
    }

    return parsed;
}

function printText(results) {
    results.forEach((result) => {
        const status = result.pass ? 'PASS' : 'FAIL';
        console.log(`[phase2:acceptance] ${status} ${result.scenario} (${result.fixtureId})`);
        result.checks.forEach((check) => {
            const marker = check.passed ? '  - ok' : '  - no';
            console.log(`${marker} ${check.name}`);
        });
    });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const results = args.scenario === 'all'
        ? await runAllScenarios()
        : [await runScenario(args.scenario)];

    if (args.json) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        printText(results);
    }

    if (results.some(result => !result.pass)) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('[phase2:acceptance] FAIL', error.message);
    process.exitCode = 1;
});
