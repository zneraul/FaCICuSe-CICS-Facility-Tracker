export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR', statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class DomainValidationError extends DomainError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Requested resource was not found.') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'A scheduling or state conflict occurred.') {
    super(message, 'CONFLICT', 409);
  }
}
