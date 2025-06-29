const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');

class Logger {
    constructor() {
        this.logger = null;
        this.initializeLogger();
    }

    async initializeLogger() {
        try {
            // Ensure logs directory exists
            const logDir = path.dirname(process.env.LOG_FILE || './logs/bot.log');
            await fs.ensureDir(logDir);

            const logLevel = process.env.LOG_LEVEL || 'info';
            const logFile = process.env.LOG_FILE || './logs/bot.log';

            // Create pino logger with both console and file output
            this.logger = pino({
                level: logLevel,
                transport: {
                    targets: [
                        {
                            target: 'pino-pretty',
                            level: logLevel,
                            options: {
                                colorize: true,
                                translateTime: 'SYS:standard',
                                ignore: 'pid,hostname'
                            }
                        },
                        {
                            target: 'pino/file',
                            level: logLevel,
                            options: {
                                destination: logFile,
                                mkdir: true
                            }
                        }
                    ]
                }
            });
        } catch (error) {
            // Fallback to basic console logger
            this.logger = pino({
                level: 'info',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:standard',
                        ignore: 'pid,hostname'
                    }
                }
            });
            console.warn('Failed to initialize file logging, using console only:', error.message);
        }
    }

    info(message, ...args) {
        if (this.logger) {
            this.logger.info(message, ...args);
        } else {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    error(message, ...args) {
        if (this.logger) {
            this.logger.error(message, ...args);
        } else {
            console.error(`[ERROR] ${message}`, ...args);
        }
    }

    warn(message, ...args) {
        if (this.logger) {
            this.logger.warn(message, ...args);
        } else {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    debug(message, ...args) {
        if (this.logger) {
            this.logger.debug(message, ...args);
        } else {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }

    trace(message, ...args) {
        if (this.logger) {
            this.logger.trace(message, ...args);
        } else {
            console.trace(`[TRACE] ${message}`, ...args);
        }
    }

    child(bindings) {
        if (this.logger) {
            return this.logger.child(bindings);
        }
        return this;
    }
}

const logger = new Logger();

module.exports = logger;