export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  data: any;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    stack = '',
    data: any = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.data = data;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
