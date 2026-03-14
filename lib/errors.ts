export abstract class AppException extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export class NetworkException extends AppException {
  constructor(message = 'Unable to reach the server') {
    super(message);
  }
}

export class TimeoutException extends AppException {
  constructor(message = 'The request timed out') {
    super(message);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Unauthorized request', statusCode = 401) {
    super(message, statusCode);
  }
}

export class ForbiddenException extends AppException {
  constructor(
    message = 'You do not have permission to perform this action',
    statusCode = 403,
  ) {
    super(message, statusCode);
  }
}

export class NotFoundException extends AppException {
  constructor(message = 'Requested resource was not found', statusCode = 404) {
    super(message, statusCode);
  }
}

export class ValidationException extends AppException {
  constructor(message = 'Invalid request data', statusCode = 422) {
    super(message, statusCode);
  }
}

export class ServerException extends AppException {
  constructor(message = 'Server error, please try again later', statusCode = 500) {
    super(message, statusCode);
  }
}

export class UnknownException extends AppException {
  constructor(message = 'Something went wrong', statusCode?: number) {
    super(message, statusCode);
  }
}

export class OutdatedVersionException extends AppException {
  constructor(message = 'App version is outdated', statusCode = 400) {
    super(message, statusCode);
  }
}

export function mapErrorToMessage(error: unknown) {
  if (error instanceof AppException) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
