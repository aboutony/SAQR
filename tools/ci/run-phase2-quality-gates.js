#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const JS_ROOTS = [
    'services/workflow-engine/src',
    'shared',
    'tools/phase2-acceptance',
    'tools/phase2-entity',
    'tools/phase2-sovereign',
    'tools/phase2-workflow',
    'tools/ci',
];
const SOVEREIGN_COMPOSE_OVERLAYS = [
    'infra/docker-compose.single-tenant-sovereign-cloud.yml',
    'infra/docker-compose.per-country-sovereign-cloud.yml',
    'infra/docker-compose.per-cluster-entity-ring.yml',
    'infra/docker-compose.client-on-premises.yml',
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
    process.stdout.write(`\n[phase2:quality] ${name}\n`);

    try {
        const details = fn();
        console.log(`[phase2:quality] PASS ${name}`);
        return { name, status: 'passed', details };
    } catch (error) {
        console.error(`[phase2:quality] FAIL ${name}: ${error.message}`);
        return { name, status: 'failed', error: error.message };
    }
}

function assertSuccess(result, failureMessage) {
    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(failureMessage);
    }
}

function syntaxGate() {
    const files = JS_ROOTS.flatMap(walkJsFiles).sort();
    for (const file of files) {
        const relativeFile = path.relative(REPO_ROOT, file);
        const result = runCommand('node', ['--check', relativeFile]);
        assertSuccess(result, `Syntax check failed for ${relativeFile}`);
    }

    return { checkedFiles: files.length };
}

function workflowGate() {
    const npm = npmCommand();
    assertSuccess(runCommand(npm, ['run', 'phase2:workflow:test']), 'Workflow DSL validator tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:workflow:engine:test']), 'Workflow engine tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:workflow:validate']), 'Workflow definition validation failed');

    return {
        workflowValidatorTests: true,
        workflowEngineTests: true,
        workflowDefinitionValidation: true,
    };
}

function entityGate() {
    const npm = npmCommand();
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:test']), 'Entity model tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:validate']), 'Entity hierarchy validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:scope:validate']), 'Entity scoping validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:isolation:validate']), 'Entity isolation validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:rollup:validate']), 'Entity roll-up validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:entity:reporting:validate']), 'Entity reporting validation failed');

    return {
        entityTests: true,
        hierarchyValidation: true,
        scopingValidation: true,
        isolationValidation: true,
        rollupValidation: true,
        reportingValidation: true,
    };
}

function sovereignGate() {
    const npm = npmCommand();
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:test']), 'Sovereign topology tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:policy:test']), 'Sovereign policy tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:packaging:test']), 'Sovereign packaging tests failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:validate']), 'Sovereign topology validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:policy:validate']), 'Sovereign policy validation failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:sovereign:packaging:validate']), 'Sovereign packaging validation failed');

    return {
        topologyTests: true,
        policyTests: true,
        packagingTests: true,
        topologyValidation: true,
        policyValidation: true,
        packagingValidation: true,
    };
}

function acceptanceGate() {
    const npm = npmCommand();
    assertSuccess(runCommand(npm, ['run', 'phase2:acceptance']), 'Phase 2 acceptance replay failed');
    assertSuccess(runCommand(npm, ['run', 'phase2:acceptance:test']), 'Phase 2 acceptance harness tests failed');

    return {
        replayCli: 'tools/phase2-acceptance/run-phase2-acceptance.js',
        harnessTests: 'tools/phase2-acceptance/harness.test.js',
    };
}

function handoffPackageGate() {
    const npm = npmCommand();
    assertSuccess(runCommand(npm, ['run', 'phase2:handoff:verify']), 'Phase 2 handoff package verification failed');

    return {
        manifest: 'docs/handoff/saqr-phase2-handoff-manifest.yaml',
        verifier: 'tools/ci/verify-phase2-handoff-package.js',
    };
}

function uiBaselineGate() {
    const npm = npmCommand();
    const cwd = path.join(REPO_ROOT, 'apps/shield-ui');
    const result = runCommand(npm, ['run', 'ui:baseline:check'], { cwd });
    assertSuccess(result, 'UI baseline regression check failed');

    return { manifest: 'apps/shield-ui/ui-baseline.manifest.json' };
}

function sovereignComposeGate({ ciMode }) {
    const dockerVersion = runCommand('docker', ['--version'], { capture: true });
    if (dockerVersion.error || dockerVersion.status !== 0) {
        if (ciMode) {
            throw new Error('Docker is required in CI mode');
        }

        console.log('[phase2:quality] SKIP sovereign-compose-overlays (docker not available)');
        return { skipped: true, reason: 'docker-not-available' };
    }

    const validated = [];
    for (const overlay of SOVEREIGN_COMPOSE_OVERLAYS) {
        const compose = runCommand('docker', ['compose', '-f', 'infra/docker-compose.production.yml', '-f', overlay, 'config'], {
            capture: true,
        });
        if (compose.error) {
            throw compose.error;
        }
        if (compose.status !== 0) {
            if (compose.stdout) process.stdout.write(compose.stdout);
            if (compose.stderr) process.stderr.write(compose.stderr);
            throw new Error(`docker compose config failed for ${overlay}`);
        }
        validated.push(overlay);
    }

    return { validatedOverlays: validated };
}

function main() {
    const ciMode = process.argv.includes('--ci');
    const gates = [
        () => runGate('syntax-checks', syntaxGate),
        () => runGate('workflow-regressions', workflowGate),
        () => runGate('entity-regressions', entityGate),
        () => runGate('sovereign-regressions', sovereignGate),
        () => runGate('acceptance-replays', acceptanceGate),
        () => runGate('handoff-package', handoffPackageGate),
        () => runGate('ui-baseline', uiBaselineGate),
        () => runGate('sovereign-compose-overlays', () => sovereignComposeGate({ ciMode })),
    ];

    const results = gates.map(run => run());
    const failed = results.filter(result => result.status === 'failed');

    console.log('\n[phase2:quality] Summary');
    results.forEach((result) => {
        console.log(`- ${result.status.toUpperCase()}: ${result.name}`);
    });

    if (failed.length > 0) {
        process.exit(1);
    }
}

main();
