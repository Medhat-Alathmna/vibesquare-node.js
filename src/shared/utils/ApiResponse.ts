export class ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data: T;
  message: string;

  constructor(statusCode: number, data: T, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  static success<T>(data: T, message = 'Success'): ApiResponse<T> {
    return new ApiResponse(200, data, message);
  }

  static created<T>(data: T, message = 'Created successfully'): ApiResponse<T> {
    return new ApiResponse(201, data, message);
  }

  static error(message: string, statusCode = 500): ApiResponse<null> {
    return new ApiResponse(statusCode, null, message);
  }

  static badRequest(message: string): ApiResponse<null> {
    return new ApiResponse(400, null, message);
  }

  static unauthorized(message = 'Unauthorized'): ApiResponse<null> {
    return new ApiResponse(401, null, message);
  }

  static forbidden(message = 'Forbidden'): ApiResponse<null> {
    return new ApiResponse(403, null, message);
  }

  static notFound(message = 'Not found'): ApiResponse<null> {
    return new ApiResponse(404, null, message);
  }
}
