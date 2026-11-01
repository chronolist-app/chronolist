import AppError from "./AppError";

class ApiError extends AppError {
    public readonly status?: number;
    public readonly responseBody?: unknown;
    constructor(message: string, status?: number, options?: {cause?: unknown, responseBody?: unknown}) {
        super(message, "API_ERROR", options);
        this.status = status;
        this.responseBody = options?.responseBody;
    }
}

export default ApiError;