class AppError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;

  constructor(message: string, code: string = "APP_ERROR", options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = options?.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export default AppError;