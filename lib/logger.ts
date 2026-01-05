/**
 * Simple structured logger for server-side actions.
 * Provides consistent formatting and request ID generation.
 */

export interface LogContext {
    requestId: string;
    action: string;
    [key: string]: unknown;
}

export const logger = {
    generateRequestId(): string {
        return Math.random().toString(36).substring(2, 10);
    },

    info(message: string, context?: LogContext) {
        if (context) {
            console.log(`[Action:${context.action}:${context.requestId}] ${message}`);
        } else {
            console.log(message);
        }
    },

    error(message: string, error: unknown, context?: LogContext) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (context) {
            console.error(`[Action:${context.action}:${context.requestId}] ${message}`, error);
        } else {
            console.error(`${message}: ${errorMsg}`, error);
        }
    },

    warn(message: string, context?: LogContext) {
        if (context) {
            console.warn(`[Action:${context.action}:${context.requestId}] ${message}`);
        } else {
            console.warn(message);
        }
    }
};
