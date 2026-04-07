#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTAINER_SERVICES = [
    'api',
    'shield-ui',
    'evidence-vault',
    'nlp-interpreter',
    'cv-watchman',
    'sentinel-scrapers',
];

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

function run(command, args) {
    const spawnTarget = resolveSpawn(command, args);
    const result = spawnSync(spawnTarget.command, spawnTarget.args, {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function runCaptured(command, args) {
    const spawnTarget = resolveSpawn(command, args);
    const result = spawnSync(spawnTarget.command, spawnTarget.args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        process.exit(result.status || 1);
    }
}

function main() {
    const buildContainers = process.argv.includes('--build-containers');

    console.log('[phase1:release] running Phase 1 quality gates');
    run('node', ['tools/ci/run-phase1-quality-gates.js', '--ci']);

    console.log('[phase1:release] validating docker compose configuration');
    runCaptured('docker', ['compose', '-f', 'infra/docker-compose.production.yml', 'config']);

    if (buildContainers) {
        console.log('[phase1:release] building production-ready images');
        run('docker', ['compose', '-f', 'infra/docker-compose.production.yml', 'build', ...CONTAINER_SERVICES]);
    } else {
        console.log('[phase1:release] container build skipped (pass --build-containers to enable)');
    }

    console.log('[phase1:release] release-readiness verification complete');
}

main();
