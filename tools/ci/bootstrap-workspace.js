#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_DIRS = [
    'apps/api',
    'apps/shield-ui',
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

function run(command, args, cwd, env = process.env) {
    const spawnTarget = resolveSpawn(command, args);
    const result = spawnSync(spawnTarget.command, spawnTarget.args, {
        cwd,
        env,
        stdio: 'inherit',
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function hasNodeModules(packageDir) {
    const nodeModulesDir = path.join(packageDir, 'node_modules');
    if (!fs.existsSync(nodeModulesDir)) return false;

    try {
        return fs.readdirSync(nodeModulesDir).length > 0;
    } catch (error) {
        return false;
    }
}

function main() {
    const force = process.argv.includes('--force');
    const npm = npmCommand();

    for (const relativeDir of PACKAGE_DIRS) {
        const packageDir = path.join(REPO_ROOT, relativeDir);
        const packageJson = path.join(packageDir, 'package.json');

        if (!fs.existsSync(packageJson)) {
            throw new Error(`Missing package.json in ${relativeDir}`);
        }

        if (!force && hasNodeModules(packageDir)) {
            console.log(`[phase1:bootstrap] skipping ${relativeDir} (node_modules already present)`);
            continue;
        }

        console.log(`[phase1:bootstrap] installing ${relativeDir}`);
        run(npm, ['install', '--no-package-lock'], packageDir, {
            ...process.env,
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || '1',
        });
    }

    console.log('[phase1:bootstrap] workspace bootstrap complete');
}

main();
