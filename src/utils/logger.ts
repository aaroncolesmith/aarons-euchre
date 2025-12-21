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

    static info(message: string, data?: any) {
        console.log(this.formatMessage('INFO', message), data || '');
    }

    static warn(message: string, data?: any) {
        console.warn(this.formatMessage('WARN', message), data || '');
    }

    static error(message: string, error?: any) {
        console.error(this.formatMessage('ERROR', message), error || '');
    }

    static debug(message: string, data?: any) {
        // In a real app, we might gate this behind an env var
        console.debug(this.formatMessage('DEBUG', message), data || '');
    }
}

export default Logger;
