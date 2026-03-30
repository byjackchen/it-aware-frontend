/**
 * Custom error class for API responses that includes the HTTP status code.
 * Allows callers to distinguish 403 (access denied) from 404 (not found) and other errors.
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
