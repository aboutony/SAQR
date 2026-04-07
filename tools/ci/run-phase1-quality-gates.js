#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const JS_ROOTS = [
    'apps/api/src',
    'apps/shield-ui',
    'services/evidence-vault/src',
    'services/nlp-interpreter/src',
    'services/cv-watchman/src',
    'services/sentinel-scrapers/src',
    'shared',
    'tools/phase1-acceptance',
    'tools/ci',
];
const TEST_PACKAGES = [
    'apps/api',
    'services/evidence-vault',
    'services/nlp-interpreter',
    'services/cv-watchman',
    'services/sentinel-scrapers',
];

function npmCommand() {
    return 'npm';
}

function resolveSpawn(command, args) {
    if (process.platform !== 'win32') {
        return {
            command,
            args,
        };
    }

    return {
        command: process.env.comspec || 'cmd.exe',
        args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    };
}

function runCommand(command, args, { cwd = REPO_ROOT, env = process.env, capture = false } = {}) {
    const spawnTarget = resolveSpawn(command, args);
    const result = spawnSync(spawnTarget.command, spawnTarget.args, {
        cwd,
        env,
        encoding: capture ? 'utf8' : undefined,
        stdio: capture ? 'pipe' : 'inherit',
    });

    return {
        error: result.error || null,
        status: result.status || 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}

function walkJsFiles(relativeDir) {
    const root = path.join(REPO_ROOT, relativeDir);
    const collected = [];

    function visit(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.vercel') {
                continue;
            }

            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }

            if (entry.isFile() && entry.name.endsWith('.js')) {
                collected.push(fullPath);
            }
        }
    }

    visit(root);
    return collected;
}

function runGate(name, fn) {
    process.stdout.write(`\n[phase1:quality] ${name}\n`);

    try {
        const details = fn();
        console.log(`[phase1:quality] PASS ${name}`);
        return { name, status: 'passed', details };
    } catch (error) {
        console.error(`[phase1:quality] FAIL ${name}: ${error.message}`);
        return { name, status: 'failed', error: error.message };
    }
}

function syntaxGate() {
    const files = JS_ROOTS.flatMap(walkJsFiles).sort();
    for (const file of files) {
        const relativeFile = path.relative(REPO_ROOT, file);
        const result = runCommand('node', ['--check', relativeFile]);
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`Syntax check failed for ${relativeFile}`);
        }
    }

    return { checkedFiles: files.length };
}

function packageTestsGate() {
    const npm = npmCommand();
    for (const relativeDir of TEST_PACKAGES) {
        const cwd = path.join(REPO_ROOT, relativeDir);
        const result = runCommand(npm, ['test'], { cwd });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`Package tests failed in ${relativeDir}`);
        }
    }

    return { testedPackages: TEST_PACKAGES.length };
}

function uiBaselineGate() {
    const npm = npmCommand();
    const cwd = path.join(REPO_ROOT, 'apps/shield-ui');
    const result = runCommand(npm, ['run', 'ui:baseline:check'], { cwd });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error('UI baseline regression check failed');
    }

    return { manifest: 'apps/shield-ui/ui-baseline.manifest.json' };
}

function acceptanceGate() {
    const cli = runCommand('node', ['tools/phase1-acceptance/run-phase1-acceptance.js', '--scenario', 'all']);
    if (cli.error) {
        throw cli.error;
    }
    if (cli.status !== 0) {
        throw new Error('Acceptance replay CLI failed');
    }

    const testRun = runCommand('node', ['--test', 'tools/phase1-acceptance/harness.test.js']);
    if (testRun.error) {
        throw testRun.error;
    }
    if (testRun.status !== 0) {
        throw new Error('Acceptance harness tests failed');
    }

    return {
        harness: 'tools/phase1-acceptance/harness.test.js',
        cli: 'tools/phase1-acceptance/run-phase1-acceptance.js',
    };
}

function handoffPackageGate() {
    const result = runCommand('node', ['tools/ci/verify-phase1-handoff-package.js']);
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error('Phase 1 handoff package verification failed');
    }

    return {
        manifest: 'docs/handoff/saqr-phase1-handoff-manifest.yaml',
    };
}

function dockerConfigGate({ ciMode }) {
    const dockerVersion = runCommand('docker', ['--version'], { capture: true });
    if (dockerVersion.error || dockerVersion.status !== 0) {
        if (ciMode) {
            throw new Error('Docker is required in CI mode');
        }

        console.log('[phase1:quality] SKIP deployment-compose-config (docker not available)');
        return { skipped: true, reason: 'docker-not-available' };
    }

    const compose = runCommand('docker', ['compose', '-f', 'infra/docker-compose.production.yml', 'config'], {
        capture: true,
    });
    if (compose.error) {
        throw compose.error;
    }
    if (compose.status !== 0) {
        if (compose.stdout) process.stdout.write(compose.stdout);
        if (compose.stderr) process.stderr.write(compose.stderr);
        throw new Error('docker compose config failed');
    }

    return {
        composeFile: 'infra/docker-compose.production.yml',
    };
}

function main() {
    const ciMode = process.argv.includes('--ci');
    const gates = [
        () => runGate('syntax-checks', syntaxGate),
        () => runGate('package-tests', packageTestsGate),
        () => runGate('ui-baseline', uiBaselineGate),
        () => runGate('acceptance-replays', acceptanceGate),
        () => runGate('handoff-package', handoffPackageGate),
        () => runGate('deployment-compose-config', () => dockerConfigGate({ ciMode })),
    ];

    const results = gates.map(run => run());
    const failed = results.filter(result => result.status === 'failed');

    console.log('\n[phase1:quality] Summary');
    results.forEach((result) => {
        console.log(`- ${result.status.toUpperCase()}: ${result.name}`);
    });

    if (failed.length > 0) {
        process.exit(1);
    }
}

main();
