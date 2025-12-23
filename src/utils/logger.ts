const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
    private static formatMessage(level: LogLevel, message: string) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    static info(message: string, ...args: any[]) {
        console.log(this.formatMessage('INFO', message), ...args);
    }

    static warn(message: string, ...args: any[]) {
        console.warn(this.formatMessage('WARN', message), ...args);
    }

    static error(message: string, ...args: any[]) {
        console.error(this.formatMessage('ERROR', message), ...args);
    }

    static debug(message: string, ...args: any[]) {
        // In a real app, we might gate this behind an env var
        console.debug(this.formatMessage('DEBUG', message), ...args);
    }
}

export default Logger;
