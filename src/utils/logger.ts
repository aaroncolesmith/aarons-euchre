import { supabase } from '../lib/supabase.ts';

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogMetadata {
    userName?: string;
    tableCode?: string;
    appVersion?: string;
    environment?: 'client' | 'server';
}

class Logger {
    private static metadata: LogMetadata = {
        environment: typeof window === 'undefined' ? 'server' : 'client'
    };

    static setMetadata(metadata: Partial<LogMetadata>) {
        this.metadata = { ...this.metadata, ...metadata };
    }

    private static formatMessage(level: LogLevel, message: string) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    private static async remoteLog(level: LogLevel, message: string, context?: any) {
        // Only log warnings and errors to the cloud to save on bandwidth/storage
        if (level !== 'WARN' && level !== 'ERROR') return;
        
        try {
            await supabase.from('app_logs').insert({
                level,
                message,
                context: context ? JSON.stringify(context) : null,
                user_name: this.metadata.userName,
                table_code: this.metadata.tableCode,
                app_version: this.metadata.appVersion || '1.68',
                environment: this.metadata.environment
            });
        } catch (err) {
            // Silently fail to avoid infinite logging loops
        }
    }

    static info(message: string, ...args: any[]) {
        console.log(this.formatMessage('INFO', message), ...args);
    }

    static warn(message: string, ...args: any[]) {
        console.warn(this.formatMessage('WARN', message), ...args);
        this.remoteLog('WARN', message, args.length > 0 ? args : undefined);
    }

    static error(message: string, ...args: any[]) {
        console.error(this.formatMessage('ERROR', message), ...args);
        this.remoteLog('ERROR', message, args.length > 0 ? args : undefined);
    }

    static debug(message: string, ...args: any[]) {
        console.debug(this.formatMessage('DEBUG', message), ...args);
    }
}

export default Logger;
