import AppError from "./AppError";

class NotFoundError extends AppError {
  constructor(message: string = "対象が見つかりません", options?: { cause?: unknown }) {
    super(message, "NOT_FOUND", options);
  }
}

export default NotFoundError;