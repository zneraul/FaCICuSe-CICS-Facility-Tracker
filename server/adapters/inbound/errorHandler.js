import { DomainError } from '../../domain/errors.js';

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  console.error('[HTTP Error]', err);
  return res.status(500).json({
    error: 'An unexpected server error occurred. Please try again.',
  });
}
