const { envFlag } = require('./runtime-profile');

const LEVEL_PRIORITIES = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50,
};

function normaliseLogLevel(value) {
    const level = String(value || 'info').trim().toLowerCase();
    return LEVEL_PRIORITIES[level] ? level : 'info';
}

function resolveObservabilitySettings(env = process.env) {
    return {
        level: normaliseLogLevel(env.SAQR_LOG_LEVEL),
        includeStacks: envFlag(env.SAQR_LOG_INCLUDE_STACKS, false),
        auditEnabled: envFlag(env.SAQR_AUDIT_LOG_ENABLED, true),
    };
}

function serialiseError(error, includeStacks = false) {
    if (!error) return null;

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            code: error.code || null,
            stack: includeStacks ? error.stack : undefined,
        };
    }

    if (typeof error === 'object') {
        return error;
    }

    return { message: String(error) };
}

function writeRecord(record) {
    const line = JSON.stringify(record);

    if (record.level === 'fatal' || record.level === 'error') {
        console.error(line);
        return;
    }

    if (record.level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
}

function createServiceLogger({ service, runtime, env = process.env, bindings = {} }) {
    const settings = resolveObservabilitySettings(env);
    const runtimeMode = runtime?.mode || runtime || 'unknown';

    function emit(level, event, fields = {}) {
        if (LEVEL_PRIORITIES[level] < LEVEL_PRIORITIES[settings.level]) {
            return;
        }

        const record = {
            timestamp: new Date().toISOString(),
            level,
            service,
            runtimeMode,
            event,
            ...bindings,
            ...fields,
        };

        if (record.error) {
            record.error = serialiseError(record.error, settings.includeStacks);
        }

        writeRecord(record);
    }

    return {
        settings,
        child(extraBindings = {}) {
            return createServiceLogger({
                service,
                runtime,
                env,
                bindings: { ...bindings, ...extraBindings },
            });
        },
        debug(event, fields = {}) {
            emit('debug', event, fields);
        },
        info(event, fields = {}) {
            emit('info', event, fields);
        },
        warn(event, fields = {}) {
            emit('warn', event, fields);
        },
        error(event, error, fields = {}) {
            emit('error', event, { ...fields, error });
        },
        fatal(event, error, fields = {}) {
            emit('fatal', event, { ...fields, error });
        },
        audit(action, fields = {}) {
            if (!settings.auditEnabled) return;
            emit('info', `audit.${action}`, {
                category: 'audit',
                ...fields,
            });
        },
    };
}

async function invokeShutdown(onShutdown, signal, context) {
    if (typeof onShutdown !== 'function') return;
    await onShutdown(signal, context);
}

function installProcessHandlers({ logger, onShutdown }) {
    let shuttingDown = false;

    async function shutdown(signal, exitCode = 0, context = {}) {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info('process.shutdown.started', {
            signal,
            exitCode,
            ...context,
        });

        try {
            await invokeShutdown(onShutdown, signal, context);
            logger.info('process.shutdown.completed', {
                signal,
                exitCode,
            });
        } catch (error) {
            logger.error('process.shutdown.failed', error, { signal });
            exitCode = 1;
        } finally {
            process.exit(exitCode);
        }
    }

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (reason) => {
        logger.error('process.unhandled_rejection', reason);
    });

    process.on('uncaughtException', (error) => {
        logger.fatal('process.uncaught_exception', error);
        shutdown('uncaughtException', 1, { origin: 'uncaughtException' }).catch(() => {
            process.exit(1);
        });
    });

    return { shutdown };
}

module.exports = {
    createServiceLogger,
    installProcessHandlers,
    serialiseError,
    resolveObservabilitySettings,
};
