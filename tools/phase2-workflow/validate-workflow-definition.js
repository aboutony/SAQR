#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadWorkflowDefinition, validateWorkflowDefinition } = require('./validator');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_WORKFLOW_DIR = path.join(REPO_ROOT, 'fixtures', 'phase2-workflow', 'workflows');

function findWorkflowFiles(targets) {
    if (targets.length > 0) {
        return targets.map(target => path.resolve(REPO_ROOT, target));
    }

    return fs.readdirSync(DEFAULT_WORKFLOW_DIR)
        .filter(name => name.endsWith('.workflow.json'))
        .sort()
        .map(name => path.join(DEFAULT_WORKFLOW_DIR, name));
}

function main() {
    const targets = process.argv.slice(2);
    const workflowFiles = findWorkflowFiles(targets);

    if (workflowFiles.length === 0) {
        console.error('[phase2:workflow] no workflow definition files found');
        process.exit(1);
    }

    let failureCount = 0;

    for (const workflowFile of workflowFiles) {
        const relativePath = path.relative(REPO_ROOT, workflowFile);
        let document;

        try {
            document = loadWorkflowDefinition(workflowFile);
        } catch (error) {
            console.error(`[phase2:workflow] FAIL ${relativePath}: ${error.message}`);
            failureCount += 1;
            continue;
        }

        const errors = validateWorkflowDefinition(document, relativePath);
        if (errors.length > 0) {
            console.error(`[phase2:workflow] FAIL ${relativePath}`);
            errors.forEach(error => console.error(`- ${error}`));
            failureCount += 1;
            continue;
        }

        console.log(`[phase2:workflow] PASS ${relativePath}`);
    }

    if (failureCount > 0) {
        process.exit(1);
    }

    console.log(`[phase2:workflow] validated ${workflowFiles.length} workflow definition file(s)`);
}

main();
