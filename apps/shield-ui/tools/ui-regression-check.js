const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(UI_ROOT, 'ui-baseline.manifest.json');
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js']);
const EXCLUDED_FILES = new Set([
    'package.json',
    'ui-baseline.manifest.json',
    'vercel.json',
]);
const EXCLUDED_JS_PREFIXES = ['runtime-config'];

function normaliseText(content) {
    return content.replace(/\r\n/g, '\n');
}

function hashText(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function shouldTrackEntry(entryName) {
    const fullPath = path.join(UI_ROOT, entryName);
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
        return false;
    }

    if (EXCLUDED_FILES.has(entryName)) {
        return false;
    }

    const extension = path.extname(entryName);
    if (!TEXT_EXTENSIONS.has(extension)) {
        return false;
    }

    if (extension === '.js' && EXCLUDED_JS_PREFIXES.some((prefix) => entryName.startsWith(prefix))) {
        return false;
    }

    return true;
}

function classifyRole(filePath) {
    const name = path.basename(filePath);

    if (name === 'styles.css') {
        return 'style-system';
    }

    if (name === 'index.html' || name === 'GatewaySelector.html') {
        return 'entry-shell';
    }

    if (name === 'app.js') {
        return 'primary-dashboard';
    }

    if (name.endsWith('Modal.js') || name.endsWith('Report.js')) {
        return 'ui-overlay';
    }

    return 'ui-module';
}

function buildFileRecord(fileName) {
    const absolutePath = path.join(UI_ROOT, fileName);
    const rawText = fs.readFileSync(absolutePath, 'utf8');
    const text = normaliseText(rawText);

    return {
        path: fileName.replace(/\\/g, '/'),
        role: classifyRole(fileName),
        sha256: hashText(text),
        lineCount: text.length === 0 ? 0 : text.split('\n').length,
        byteCount: Buffer.byteLength(text, 'utf8'),
    };
}

function getTrackedFiles() {
    return fs.readdirSync(UI_ROOT)
        .filter(shouldTrackEntry)
        .sort((left, right) => left.localeCompare(right))
        .map(buildFileRecord);
}

function buildManifest() {
    const files = getTrackedFiles();

    return {
        schemaVersion: 1,
        phase: 'Phase 1',
        checkpoints: ['P1-201', 'P1-202'],
        baselineDate: '2026-04-07',
        guardrail: 'Any drift in tracked UI files requires explicit approval before baseline refresh.',
        trackedFileCount: files.length,
        files,
    };
}

function loadBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) {
        throw new Error(`Baseline file not found: ${BASELINE_PATH}`);
    }

    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function indexByPath(files) {
    return new Map(files.map((file) => [file.path, file]));
}

function compareBaseline(baseline, current) {
    const baselineFiles = indexByPath(baseline.files || []);
    const currentFiles = indexByPath(current.files || []);
    const drift = [];

    for (const [filePath, baselineFile] of baselineFiles.entries()) {
        const currentFile = currentFiles.get(filePath);
        if (!currentFile) {
            drift.push({
                type: 'missing',
                path: filePath,
                expected: baselineFile.sha256,
                actual: null,
            });
            continue;
        }

        if (baselineFile.sha256 !== currentFile.sha256) {
            drift.push({
                type: 'changed',
                path: filePath,
                expected: baselineFile.sha256,
                actual: currentFile.sha256,
            });
        }
    }

    for (const [filePath, currentFile] of currentFiles.entries()) {
        if (!baselineFiles.has(filePath)) {
            drift.push({
                type: 'new',
                path: filePath,
                expected: null,
                actual: currentFile.sha256,
            });
        }
    }

    return drift.sort((left, right) => left.path.localeCompare(right.path));
}

function writeBaseline() {
    const manifest = buildManifest();
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Wrote UI baseline for ${manifest.trackedFileCount} files to ${BASELINE_PATH}`);
}

function checkBaseline() {
    const baseline = loadBaseline();
    const current = buildManifest();
    const drift = compareBaseline(baseline, current);

    if (drift.length === 0) {
        console.log(`UI baseline check passed for ${current.trackedFileCount} files.`);
        return;
    }

    console.error(`UI baseline drift detected in ${drift.length} file(s):`);
    drift.forEach((entry) => {
        console.error(`- ${entry.type.toUpperCase()} ${entry.path}`);
        if (entry.expected) {
            console.error(`  expected: ${entry.expected}`);
        }
        if (entry.actual) {
            console.error(`  actual:   ${entry.actual}`);
        }
    });
    process.exitCode = 1;
}

function main() {
    const args = new Set(process.argv.slice(2));

    if (args.has('--write-baseline')) {
        writeBaseline();
        return;
    }

    checkBaseline();
}

main();
