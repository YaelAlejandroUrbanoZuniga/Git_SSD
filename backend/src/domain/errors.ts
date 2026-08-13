export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

/** Domain/business rule violation (409). */
export class BusinessRuleError extends ApiError {
  constructor(message: string) {
    super(409, message, 'BUSINESS_RULE');
  }
}

/**
 * The request collides with state someone else already wrote (409). Distinct
 * from `BusinessRuleError`, which is "this transition is not allowed": a
 * conflict is "somebody got there first, and overwriting them silently would
 * lose their decision" — e.g. a second user marking interest on a prospect.
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Not allowed') {
    super(403, message, 'FORBIDDEN');
  }
}
