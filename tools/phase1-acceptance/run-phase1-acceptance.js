#!/usr/bin/env node

const { runAllScenarios, runScenario } = require('./harness');

function parseArgs(argv) {
    const args = { scenario: 'all', json: false };

    for (let index = 0; index < argv.length; index++) {
        const value = argv[index];
        if (value === '--scenario' && argv[index + 1]) {
            args.scenario = argv[index + 1];
            index += 1;
        } else if (value === '--json') {
            args.json = true;
        }
    }

    return args;
}

function printHuman(results) {
    results.forEach((result) => {
        console.log(`${result.scenario}: ${result.pass ? 'PASS' : 'FAIL'}`);
        result.checks.forEach((check) => {
            console.log(`  - ${check.passed ? 'PASS' : 'FAIL'} ${check.name}`);
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
        printHuman(results);
    }

    if (results.some(result => !result.pass)) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
